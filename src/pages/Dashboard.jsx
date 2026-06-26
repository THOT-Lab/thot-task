import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProjects } from '../contexts/ProjectsContext'
import Modal from '../components/Modal'

export default function Dashboard() {
  const { user, profile } = useAuth()
  const { projects, reload } = useProjects()
  const navigate = useNavigate()

  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, is_done, project_id, assigned_to, position, created_at')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
    setTasks(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadTasks()
  }, [])

  const statsByProject = useMemo(() => {
    const m = {}
    for (const p of projects) m[p.id] = { pending: 0, total: 0 }
    for (const t of tasks) {
      if (!m[t.project_id]) m[t.project_id] = { pending: 0, total: 0 }
      m[t.project_id].total += 1
      if (!t.is_done) m[t.project_id].pending += 1
    }
    return m
  }, [projects, tasks])

  // Mes tâches (ordre conservé : une tâche cochée ne bouge pas)
  const myTasks = useMemo(
    () => tasks.filter((t) => t.assigned_to === user?.id),
    [tasks, user?.id]
  )
  const myTasksByProject = useMemo(() => {
    const m = {}
    for (const t of myTasks) (m[t.project_id] ||= []).push(t)
    return m
  }, [myTasks])

  const createProject = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setError('')
    // On n'enchaîne pas .select() pour éviter tout souci de lecture juste après l'insert ;
    // on récupère le projet séparément ensuite.
    const { error: insErr } = await supabase
      .from('projects')
      .insert({ name, created_by: user.id })
    if (insErr) {
      setBusy(false)
      console.error('[création projet]', insErr)
      setError(insErr.message || 'Création impossible.')
      return
    }
    await reload()
    const { data: latest } = await supabase
      .from('projects')
      .select('id')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setBusy(false)
    setShowNew(false)
    setNewName('')
    if (latest) navigate(`/project/${latest.id}`)
  }

  const toggleTask = async (task) => {
    await supabase.from('tasks').update({ is_done: !task.is_done }).eq('id', task.id)
    loadTasks()
  }

  const pseudo = profile?.full_name?.trim() || (profile?.email || '').split('@')[0] || 'toi'

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Bonjour {pseudo} 👋</h1>
          <p className="muted">Voici l'état de tes projets.</p>
        </div>
      </div>

      <section>
        <h2 className="section-title">Mes projets</h2>
        {loading ? (
          <p className="muted">Chargement…</p>
        ) : (
          <div className="project-grid">
            {projects.map((p) => {
              const s = statsByProject[p.id] || { pending: 0, total: 0 }
              return (
                <button
                  key={p.id}
                  className="project-card"
                  onClick={() => navigate(`/project/${p.id}`)}
                >
                  <h3>{p.name}</h3>
                  {p.description && <p className="muted card-desc">{p.description}</p>}
                  <div className="card-stats">
                    <span className={`badge ${s.pending > 0 ? 'badge-pending' : 'badge-done'}`}>
                      {s.pending} en suspens
                    </span>
                    <span className="muted small">{s.total} tâche(s)</span>
                  </div>
                </button>
              )
            })}

            <button
              className="project-card add-card"
              onClick={() => {
                setError('')
                setShowNew(true)
              }}
            >
              <span className="add-card-plus">+</span>
              <span>Nouveau projet</span>
            </button>
          </div>
        )}
      </section>

      <section>
        <h2 className="section-title">Mes tâches — tous projets</h2>
        {myTasks.length === 0 ? (
          <p className="muted">Aucune tâche ne t'est assignée pour le moment.</p>
        ) : (
          <div className="mytasks-grid">
            {projects
              .filter((p) => (myTasksByProject[p.id] || []).length)
              .map((p) => (
                <section key={p.id} className="task-table mytasks-box">
                  <div className="mytasks-head">
                    <button
                      className="mytasks-title"
                      onClick={() => navigate(`/project/${p.id}`)}
                    >
                      {p.name}
                    </button>
                  </div>
                  <ul className="task-list">
                    {myTasksByProject[p.id].map((t) => (
                      <li key={t.id} className={`task-row ${t.is_done ? 'done' : ''}`}>
                        <button
                          className={`check ${t.is_done ? 'checked' : ''}`}
                          onClick={() => toggleTask(t)}
                          aria-label="Cocher"
                        >
                          {t.is_done ? '✓' : ''}
                        </button>
                        <span className="task-title">{t.title}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
          </div>
        )}
      </section>

      {showNew && (
        <Modal title="Nouveau projet" onClose={() => setShowNew(false)}>
          <form onSubmit={createProject} className="stack">
            <label>
              <span>Nom du projet</span>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex. Refonte du site"
              />
            </label>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Création…' : 'Créer'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
