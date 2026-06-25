import { useState } from 'react'
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
  const [busy, setBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    const v = pseudo.trim()
    if (!v) return
    setBusy(true)
    await supabase.from('profiles').update({ full_name: v }).eq('id', userId)
    await onSaved()
    setBusy(false)
    onClose()
  }

  return (
    <Modal title="Mon pseudo" onClose={onClose}>
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
