import { supabase } from './supabase'

// Ajoute une personne à un projet à partir de son email.
// - Si elle a déjà un compte → ajout direct comme membre.
// - Sinon → invitation en attente (elle deviendra membre automatiquement à l'inscription).
// Dans les deux cas, on tente d'envoyer un email de notification (best-effort).
export async function addMemberByEmail(project, rawEmail) {
  const email = (rawEmail || '').trim().toLowerCase()
  if (!email || !email.includes('@')) return { error: 'Adresse email invalide.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .ilike('email', email)
    .maybeSingle()

  let status
  if (profile) {
    const { error } = await supabase
      .from('project_members')
      .insert({ project_id: project.id, user_id: profile.id })
    if (error && !isDuplicate(error)) return { error: error.message }
    status = 'added'
  } else {
    const { error } = await supabase
      .from('project_invitations')
      .insert({ project_id: project.id, email })
    if (error && !isDuplicate(error)) return { error: error.message }
    status = 'invited'
  }

  // Notification email — best-effort, ne bloque pas l'ajout.
  notify(project, email, status).catch(() => {})
  return { status }
}

// Pour un NOUVEAU partenaire (pas encore de compte), on déclenche l'envoi d'un
// email "lien magique" par Supabase : il clique, il est connecté et voit son projet.
// Pour un membre déjà inscrit, pas d'email (il a déjà accès).
async function notify(project, email, status) {
  if (status !== 'invited') return
  await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: 'https://thot-lab.github.io/thot-task/',
      data: { invited_to: project.name },
    },
  })
}

function isDuplicate(error) {
  return (error?.code === '23505') || /duplicate key/i.test(error?.message || '')
}
