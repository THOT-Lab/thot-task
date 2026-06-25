import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { isSupabaseConfigured } from './lib/supabase'
import Layout from './components/Layout'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import ProjectPage from './pages/ProjectPage'
import AdminPage from './pages/AdminPage'

function Protected({ children, adminOnly = false }) {
  const { session, loading, isAdmin } = useAuth()
  if (loading) return <div className="screen-center muted">Chargement…</div>
  if (!session) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { session } = useAuth()

  if (!isSupabaseConfigured) {
    return (
      <div className="screen-center">
        <div className="config-warning">
          <h1>⚙️ Configuration requise</h1>
          <p>
            Les variables Supabase ne sont pas renseignées. Copie le fichier{' '}
            <code>.env.example</code> en <code>.env</code>, renseigne{' '}
            <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code>, puis
            relance <code>npm run dev</code>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to="/" replace /> : <AuthPage />}
      />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/project/:id" element={<ProjectPage />} />
        <Route
          path="/admin"
          element={
            <Protected adminOnly>
              <AdminPage />
            </Protected>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
