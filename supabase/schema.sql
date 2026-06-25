-- ============================================================================
--  THOT Tasks — Schéma de base de données Supabase
--  À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
--  Réexécutable sans danger (idempotent autant que possible).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
--  TABLES
-- ----------------------------------------------------------------------------

-- Profils utilisateurs (1 ligne par compte auth)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  full_name  text not null default '',
  role       text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now()
);

-- Projets
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  notes       text not null default '',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
-- Ajout sûr de la colonne notes pour les bases déjà créées avant cette version.
alter table public.projects add column if not exists notes text not null default '';

-- Membres d'un projet (tous full admin du projet auquel ils appartiennent)
create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- Invitations en attente (email ajouté mais pas encore inscrit)
create table if not exists public.project_invitations (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email      text not null,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, email)
);

-- Groupes / familles de tâches (sections d'organisation dans un projet)
create table if not exists public.task_groups (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name       text not null,
  position   int not null default 0,
  created_at timestamptz not null default now()
);

-- Tâches (une ligne = une tâche)
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  group_id    uuid references public.task_groups(id) on delete set null,
  title       text not null,
  tag         text not null default '',
  assigned_to uuid references public.profiles(id) on delete set null,
  is_done     boolean not null default false,
  done_at     timestamptz,
  position    int not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Ajout sûr de la colonne tag pour les bases déjà créées avant cette version.
alter table public.tasks add column if not exists tag text not null default '';

create index if not exists tasks_project_idx   on public.tasks(project_id);
create index if not exists tasks_assigned_idx  on public.tasks(assigned_to);
create index if not exists tasks_group_idx     on public.tasks(group_id);
create index if not exists members_user_idx    on public.project_members(user_id);
create index if not exists groups_project_idx  on public.task_groups(project_id);

-- ----------------------------------------------------------------------------
--  FONCTIONS UTILITAIRES (security definer → contournent RLS, évitent la récursion)
-- ----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- L'utilisateur courant est membre du projet (l'admin global voit tout)
create or replace function public.is_project_member(p_project uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_admin()
      or exists (
        select 1 from public.project_members
        where project_id = p_project and user_id = auth.uid()
      );
$$;

-- ----------------------------------------------------------------------------
--  TRIGGERS
-- ----------------------------------------------------------------------------

-- À la création d'un compte : créer le profil + transformer les invitations en adhésions.
-- L'email administrateur devient automatiquement 'admin' (mot de passe jamais stocké ici).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when lower(new.email) = lower('laurentpacoud@gmail.com')
         then 'admin' else 'member' end
  )
  on conflict (id) do nothing;

  insert into public.project_members (project_id, user_id)
  select pi.project_id, new.id
  from public.project_invitations pi
  where lower(pi.email) = lower(new.email)
  on conflict do nothing;

  delete from public.project_invitations where lower(email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- À la création d'un projet : ajouter le créateur comme membre.
create or replace function public.handle_new_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members (project_id, user_id)
  values (new.id, new.created_by)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_project_created on public.projects;
create trigger on_project_created
  after insert on public.projects
  for each row execute function public.handle_new_project();

-- Mise à jour de updated_at + done_at sur les tâches
create or replace function public.handle_task_update()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.is_done = true and (old.is_done is distinct from true) then
    new.done_at = now();
  elsif new.is_done = false then
    new.done_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_before_update on public.tasks;
create trigger tasks_before_update
  before update on public.tasks
  for each row execute function public.handle_task_update();

-- ----------------------------------------------------------------------------
--  ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.projects            enable row level security;
alter table public.project_members     enable row level security;
alter table public.project_invitations enable row level security;
alter table public.task_groups         enable row level security;
alter table public.tasks               enable row level security;

-- PROFILES : tout utilisateur connecté peut lire les profils (pour assigner / afficher
-- les noms) ; chacun modifie le sien, l'admin peut tout modifier.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- PROJECTS : visibles par leurs membres (et l'admin) ; modifiables/supprimables par
-- tout membre (tous full admin de leurs projets).
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated using (public.is_project_member(id));

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (public.is_project_member(id)) with check (public.is_project_member(id));

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated using (public.is_project_member(id));

-- PROJECT_MEMBERS : visibles et gérables par tout membre du projet.
drop policy if exists members_select on public.project_members;
create policy members_select on public.project_members
  for select to authenticated using (public.is_project_member(project_id));

drop policy if exists members_insert on public.project_members;
create policy members_insert on public.project_members
  for insert to authenticated with check (public.is_project_member(project_id));

drop policy if exists members_delete on public.project_members;
create policy members_delete on public.project_members
  for delete to authenticated using (public.is_project_member(project_id));

-- INVITATIONS : visibles par les membres du projet ou par l'invité lui-même.
drop policy if exists invitations_select on public.project_invitations;
create policy invitations_select on public.project_invitations
  for select to authenticated
  using (public.is_project_member(project_id)
         or lower(email) = lower(coalesce(auth.jwt()->>'email','')));

drop policy if exists invitations_insert on public.project_invitations;
create policy invitations_insert on public.project_invitations
  for insert to authenticated with check (public.is_project_member(project_id));

drop policy if exists invitations_delete on public.project_invitations;
create policy invitations_delete on public.project_invitations
  for delete to authenticated using (public.is_project_member(project_id));

-- TASK_GROUPS : gérables par tout membre du projet.
drop policy if exists groups_all on public.task_groups;
create policy groups_all on public.task_groups
  for all to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

-- TASKS : gérables par tout membre du projet.
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated using (public.is_project_member(project_id));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated using (public.is_project_member(project_id));

-- ============================================================================
--  Fin du schéma.
-- ============================================================================
