# THOT Tasks

Task manager partagé : projets multiples, membres par projet, listes de tâches avec
groupes, assignation (« in charge ») et historique (les tâches cochées restent barrées).

- **Front** : React + Vite (déployable sur GitHub Pages)
- **Back** : Supabase (auth email/mot de passe + base Postgres + RLS)

---

## 1. Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com) → **New project** (note le mot de passe de la base).
2. Une fois le projet prêt : **SQL Editor → New query**, colle tout le contenu de
   [`supabase/schema.sql`](supabase/schema.sql) et clique **Run**.
3. **Project Settings → API** : récupère
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY` (cette clé est publique, protégée par les règles RLS)
4. **Authentication → Providers → Email** : laisse l'email/mot de passe activé.
   Pour un usage interne simple, tu peux **désactiver « Confirm email »**
   (Authentication → Sign In / Providers) afin que les comptes soient actifs
   immédiatement sans clic de confirmation.

> **Compte admin** : le schéma fait que l'email **laurentpacoud@gmail.com** devient
> automatiquement administrateur dès son inscription. Le mot de passe n'est jamais
> stocké dans le code — tu le choisis à l'inscription. (Pour changer l'email admin,
> modifie la ligne correspondante dans `supabase/schema.sql`, fonction `handle_new_user`.)

---

## 2. Lancer en local

```bash
cp .env.example .env        # puis renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Ouvre l'URL affichée, clique **S'inscrire**, crée ton compte admin, et c'est parti.

---

## 3. Déployer sur GitHub Pages (THOT Labs)

1. Crée un dépôt (ex. `thot-tasks`) sous ton organisation **THOT Labs** et pousse ce code :
   ```bash
   git init && git add . && git commit -m "THOT Tasks"
   git branch -M main
   git remote add origin https://github.com/THOT-Labs/thot-tasks.git
   git push -u origin main
   ```
2. Dans le dépôt GitHub : **Settings → Secrets and variables → Actions → New repository secret**, ajoute :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. **Settings → Pages → Build and deployment → Source = GitHub Actions**.
4. Le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) build et publie
   automatiquement à chaque `push` sur `main`.

> ⚠️ Dans Supabase, **Authentication → URL Configuration**, ajoute l'URL GitHub Pages
> (ex. `https://thot-labs.github.io/thot-tasks/`) dans **Site URL** / **Redirect URLs**.

---

## 4. Emails de notification (optionnel)

L'app fonctionne **sans** : quand tu ajoutes un partenaire, il a accès dès qu'il se
connecte (s'il a déjà un compte) ou dès qu'il s'inscrit avec cet email (invitation).
L'email n'est qu'une **notification** en plus.

Pour l'activer, déploie l'Edge Function [`supabase/functions/notify-member`](supabase/functions/notify-member/index.ts) :

```bash
npm install -g supabase
supabase login
supabase link --project-ref TON_REF_PROJET
supabase functions deploy notify-member
supabase secrets set RESEND_API_KEY=xxx \
  NOTIFY_FROM="THOT Tasks <no-reply@ton-domaine.com>" \
  APP_URL=https://thot-labs.github.io/thot-tasks/
```

(Compte gratuit sur [resend.com](https://resend.com) ; pour envoyer vers n'importe
quelle adresse il faut vérifier un domaine. D'autres fournisseurs sont possibles —
voir le commentaire en tête de la fonction.)

---

## 5. Utilisation

- **Accueil** : synthèse par projet (tâches en suspens) + tes tâches tous projets confondus.
- **Onglets** : un par projet auquel tu as accès (toi, admin, vois tous les projets).
- **Dans un projet** : clique le nom pour le **renommer** ; **+ Add task** /
  **+ Add a task group** ; coche une tâche pour la **barrer** (gardée pour l'historique) ;
  colonne **In charge** pour l'assigner ; bouton **Partenaires** pour ajouter des membres par email.
- Tous les membres d'un projet ont les pleins droits sur ce projet.
```
