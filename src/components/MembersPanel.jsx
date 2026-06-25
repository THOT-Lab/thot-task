import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { addMemberByEmail } from '../lib/members'

export default function MembersPanel({ project, members, invitations, currentUserId, onChanged }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const res = await addMemberByEmail(project, email)
    setBusy(false)
    if (res.error) {
      setMsg({ type: 'error', text: res.error })
    } else {
      setEmail('')
      setMsg({
        type: 'ok',
        text:
          res.status === 'added'
            ? 'Partenaire ajouté au projet ✓'
            : "Invitation enregistrée — la personne aura accès dès qu'elle créera son compte avec cet email.",
      })
      onChanged()
    }
  }

  const removeMember = async (m) => {
    if (m.id === currentUserId) {
      if (!confirm('Tu vas te retirer toi-même de ce projet. Continuer ?')) return
    } else if (!confirm(`Retirer ${m.full_name || m.email} du projet ?`)) {
      return
    }
    await supabase
      .from('project_members')
      .delete()
      .eq('project_id', project.id)
      .eq('user_id', m.id)
    onChanged()
  }

  const removeInvitation = async (inv) => {
    await supabase.from('project_invitations').delete().eq('id', inv.id)
    onChanged()
  }

  return (
    <div className="members-panel">
      <form onSubmit={add} className="add-member">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@partenaire.com"
        />
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? '…' : '+ Ajouter un partenaire'}
        </button>
      </form>

      {msg && <div className={`alert alert-${msg.type === 'ok' ? 'info' : 'error'}`}>{msg.text}</div>}

      <ul className="member-list">
        {members.map((m) => (
          <li key={m.id} className="member-item">
            <div className="member-id">
              <span className="avatar small">
                {(m.full_name || m.email || '?').slice(0, 1).toUpperCase()}
              </span>
              <div>
                <div className="member-name">
                  {m.full_name || m.email}
                  {m.id === currentUserId && <span className="chip tiny">moi</span>}
                </div>
                <div className="muted small">{m.email}</div>
              </div>
            </div>
            <button className="icon-btn danger" onClick={() => removeMember(m)} title="Retirer">
              ×
            </button>
          </li>
        ))}

        {invitations.map((inv) => (
          <li key={inv.id} className="member-item pending">
            <div className="member-id">
              <span className="avatar small ghost">@</span>
              <div>
                <div className="member-name">{inv.email}</div>
                <div className="muted small">Invitation en attente</div>
              </div>
            </div>
            <button className="icon-btn danger" onClick={() => removeInvitation(inv)} title="Annuler l'invitation">
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
