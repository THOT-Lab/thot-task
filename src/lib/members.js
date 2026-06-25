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

  // Notification email — ne bloque pas l'opération si l'Edge Function n'est pas déployée.
  notify(project, email, status).catch(() => {})
  return { status }
}

async function notify(project, email, status) {
  await supabase.functions.invoke('notify-member', {
    body: { email, projectName: project.name, status },
  })
}

function isDuplicate(error) {
  return (error?.code === '23505') || /duplicate key/i.test(error?.message || '')
}
