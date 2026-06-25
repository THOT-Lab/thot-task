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
  notify(project, email).catch(() => {})
  return { status }
}

// On envoie un email "lien magique" à TOUT partenaire ajouté (nouveau ou déjà inscrit).
// Le lien le connecte et le redirige DIRECTEMENT sur le projet concerné.
async function notify(project, email) {
  await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `https://thot-lab.github.io/thot-task/?project=${project.id}`,
      data: { invited_to: project.name },
    },
  })
}

function isDuplicate(error) {
  return (error?.code === '23505') || /duplicate key/i.test(error?.message || '')
}
