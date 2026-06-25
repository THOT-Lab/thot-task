// Edge Function "notify-member"
// Envoie un email à une personne ajoutée / invitée sur un projet.
//
// Déploiement :
//   supabase functions deploy notify-member
//   supabase secrets set RESEND_API_KEY=xxx NOTIFY_FROM="THOT Tasks <no-reply@ton-domaine.com>" APP_URL=https://thot-labs.github.io/thot-tasks/
//
// L'app fonctionne SANS cette fonction : l'accès est accordé dès l'ajout,
// l'email n'est qu'une notification. Si RESEND_API_KEY n'est pas défini,
// la fonction renvoie simplement { skipped: true } sans erreur.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { email, projectName, status } = await req.json()
    if (!email || !projectName) {
      return json({ error: 'email et projectName requis' }, 400)
    }

    const apiKey = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('NOTIFY_FROM') ?? 'THOT Tasks <onboarding@resend.dev>'
    const appUrl = Deno.env.get('APP_URL') ?? ''

    if (!apiKey) {
      // Pas de fournisseur configuré : on n'échoue pas, on ignore l'email.
      return json({ skipped: true, reason: 'RESEND_API_KEY non défini' })
    }

    const isInvite = status === 'invited'
    const subject = isInvite
      ? `Invitation au projet « ${projectName} » sur THOT Tasks`
      : `Tu as été ajouté au projet « ${projectName} » sur THOT Tasks`

    const action = isInvite
      ? `Crée ton compte avec cette adresse email pour accéder au projet.`
      : `Connecte-toi pour retrouver le projet dans tes onglets.`

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#5b3df5">THOT Tasks</h2>
        <p>Bonjour,</p>
        <p>Tu as été ajouté au projet <strong>${escapeHtml(projectName)}</strong>.</p>
        <p>${action}</p>
        ${appUrl ? `<p><a href="${appUrl}" style="background:#5b3df5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Ouvrir THOT Tasks</a></p>` : ''}
        <p style="color:#7a7f99;font-size:13px">Si tu n'es pas concerné, ignore cet email.</p>
      </div>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [email], subject, html }),
    })

    const data = await res.json()
    if (!res.ok) return json({ error: data }, res.status)
    return json({ sent: true, id: data.id })
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

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  )
}
