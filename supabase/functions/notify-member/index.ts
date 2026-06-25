// Edge Function "notify-member"
// Envoie un email d'invitation (via le service email intégré de Supabase) à un
// nouveau partenaire ajouté à un projet. Pour un membre DÉJÀ inscrit, on ne fait rien
// (Supabase ne ré-invite pas un compte existant).
//
// Variables injectées automatiquement par Supabase : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const APP_URL = Deno.env.get('APP_URL') ?? 'https://thot-lab.github.io/thot-task/'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { email, projectName, status } = await req.json()
    if (!email) return json({ error: 'email requis' }, 400)

    // On n'envoie un mail que pour les nouveaux partenaires (pas encore de compte).
    if (status !== 'invited') {
      return json({ skipped: true, reason: 'membre déjà inscrit' })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: APP_URL,
      data: { invited_to: projectName ?? '' },
    })
    if (error) return json({ error: error.message }, 400)

    return json({ invited: true })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
