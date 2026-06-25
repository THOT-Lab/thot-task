import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/thot-logo.png'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
      } else {
        const { data, error } = await signUp(email, password, fullName)
        if (error) throw error
        // Si la confirmation d'email est activée, aucune session n'est créée.
        if (!data.session) {
          setInfo(
            "Compte créé ! Vérifie ta boîte mail pour confirmer l'adresse, puis connecte-toi."
          )
          setMode('login')
        }
      }
    } catch (err) {
      setError(traduireErreur(err?.message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <img className="brand-logo-img big" src={logo} alt="THOT" />
          <h1>
            THOT <span className="brand-accent">Task</span>
          </h1>
          <p className="muted">Gestion de tâches partagée</p>
        </div>

        <div className="auth-toggle">
          <button
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login')
              setError('')
              setInfo('')
            }}
            type="button"
          >
            Connexion
          </button>
          <button
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => {
              setMode('signup')
              setError('')
              setInfo('')
            }}
            type="button"
          >
            S'inscrire
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <label>
              <span>Pseudo</span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex. Lolo, Capitaine, Laurent…"
                autoComplete="nickname"
                required
              />
            </label>
          )}
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
              autoComplete="email"
              required
            />
          </label>
          <label>
            <span>Mot de passe</span>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={6}
                required
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                title={showPassword ? 'Masquer' : 'Afficher'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </label>

          {error && <div className="alert alert-error">{error}</div>}
          {info && <div className="alert alert-info">{info}</div>}

          <button className="btn btn-primary btn-block" disabled={busy} type="submit">
            {busy ? 'Patiente…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <p className="auth-footer muted">
          {mode === 'login' ? 'Pas encore de compte ?' : 'Déjà inscrit ?'}{' '}
          <button
            type="button"
            className="link"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? "S'inscrire" : 'Se connecter'}
          </button>
        </p>
      </div>
    </div>
  )
}

function traduireErreur(message = '') {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'Email ou mot de passe incorrect.'
  if (m.includes('already registered')) return 'Cette adresse est déjà utilisée.'
  if (m.includes('password should be')) return 'Le mot de passe doit faire au moins 6 caractères.'
  if (m.includes('email not confirmed')) return "Email non confirmé. Vérifie ta boîte mail."
  return message || "Une erreur est survenue."
}
