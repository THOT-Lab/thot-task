import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ProjectsProvider } from '../contexts/ProjectsContext'
import Modal from './Modal'
import logo from '../assets/thot-logo.png'

function Shell() {
  const { user, profile, isAdmin, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [showProfile, setShowProfile] = useState(false)

  // Arrivée via un lien magique "…?project=ID" → on ouvre directement le projet.
  useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get('project')
    if (pid) {
      navigate(`/project/${pid}`)
      window.history.replaceState({}, '', window.location.pathname + window.location.hash)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const pseudo = profile?.full_name || profile?.email || '?'
  const initials = pseudo
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            <img className="brand-logo-img" src={logo} alt="THOT" />
            <span className="brand-name">
              THOT <span className="brand-accent">Task</span>
            </span>
          </NavLink>

          <nav className="tabs">
            {isAdmin && (
              <NavLink to="/admin" className="tab tab-admin">
                Admin
              </NavLink>
            )}
          </nav>

          <div className="user-menu">
            <button
              className="avatar"
              title={`${pseudo} — modifier mon pseudo`}
              onClick={() => setShowProfile(true)}
            >
              {initials || '?'}
            </button>
            <button className="btn btn-ghost" onClick={handleSignOut}>
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      {showProfile && (
        <ProfileModal
          userId={user.id}
          current={profile?.full_name || ''}
          onClose={() => setShowProfile(false)}
          onSaved={refreshProfile}
        />
      )}
    </div>
  )
}

function ProfileModal({ userId, current, onClose, onSaved }) {
  const [pseudo, setPseudo] = useState(current)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async (e) => {
    e.preventDefault()
    const v = pseudo.trim()
    if (!v) return
    setBusy(true)
    setErr('')
    await supabase.from('profiles').update({ full_name: v }).eq('id', userId)
    if (password) {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setBusy(false)
        setErr(error.message)
        return
      }
    }
    await onSaved()
    setBusy(false)
    onClose()
  }

  return (
    <Modal title="Mon profil" onClose={onClose}>
      <form onSubmit={save} className="stack">
        <label>
          <span>Pseudo (affiché dans « In charge »)</span>
          <input
            autoFocus
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="Ex. Lolo, Laurent, Capitaine…"
          />
        </label>
        <label>
          <span>Mot de passe (laisser vide pour ne pas changer)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Définir / changer mon mot de passe"
            minLength={6}
            autoComplete="new-password"
          />
        </label>
        {err && <div className="alert alert-error">{err}</div>}
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? '…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Layout() {
  return (
    <ProjectsProvider>
      <Shell />
    </ProjectsProvider>
  )
}
