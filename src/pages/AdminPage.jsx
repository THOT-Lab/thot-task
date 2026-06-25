import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function AdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    // En tant qu'admin, la RLS autorise la lecture de TOUS les profils et projets.
    const { data: p } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
    const { data: pr } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: true })
    setProfiles(p ?? [])
    setProjects(pr ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const setRole = async (prof, role) => {
    await supabase.from('profiles').update({ role }).eq('id', prof.id)
    load()
  }

  const exportCSV = () => {
    const headers = ['Pseudo', 'Email', 'Rôle', 'Inscrit le']
    const rows = profiles.map((p) => [
      p.full_name || '',
      p.email || '',
      p.role || '',
      p.created_at ? new Date(p.created_at).toLocaleString('fr-FR') : '',
    ])
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`
    const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `thot-task-inscrits-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const projectsByUser = useMemo(() => {
    const m = new Map()
    for (const p of projects) {
      const key = p.created_by || 'none'
      if (!m.has(key)) m.set(key, [])
      m.get(key).push(p)
    }
    return m
  }, [projects])

  if (loading) return <div className="page muted">Chargement…</div>

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Administration</h1>
          <p className="muted">Tableau de bord global — réservé à l'administrateur.</p>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-num">{profiles.length}</div>
          <div className="muted">Utilisateurs inscrits</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{projects.length}</div>
          <div className="muted">Projets créés</div>
        </div>
      </div>

      <section>
        <h2 className="section-title">Projets par utilisateur</h2>
        <div className="admin-users">
          {profiles.map((u) => {
            const list = projectsByUser.get(u.id) || []
            return (
              <div key={u.id} className="admin-user-block">
                <div className="admin-user-head">
                  <strong>{u.full_name || u.email}</strong>
                  <span className="muted small">
                    {u.email} · {list.length} projet(s)
                    {u.role === 'admin' && <span className="chip chip-admin tiny"> admin</span>}
                  </span>
                </div>
                {list.length > 0 && (
                  <div className="admin-project-row">
                    {list.map((p) => (
                      <button
                        key={p.id}
                        className="chip chip-link"
                        onClick={() => navigate(`/project/${p.id}`)}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {(projectsByUser.get('none') || []).length > 0 && (
            <div className="admin-user-block">
              <div className="admin-user-head">
                <strong>Sans créateur</strong>
              </div>
              <div className="admin-project-row">
                {projectsByUser.get('none').map((p) => (
                  <button
                    key={p.id}
                    className="chip chip-link"
                    onClick={() => navigate(`/project/${p.id}`)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2 className="section-title">Utilisateurs ({profiles.length})</h2>
          <button className="btn btn-ghost small" onClick={exportCSV}>
            ⬇ Exporter en CSV
          </button>
        </div>
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pseudo</th>
                <th>Email</th>
                <th>Rôle</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td>{p.full_name || <span className="muted">—</span>}</td>
                  <td>{p.email}</td>
                  <td>
                    <span className={`chip ${p.role === 'admin' ? 'chip-admin' : ''}`}>
                      {p.role}
                    </span>
                  </td>
                  <td className="right">
                    {p.id !== user.id &&
                      (p.role === 'admin' ? (
                        <button className="btn btn-ghost small" onClick={() => setRole(p, 'member')}>
                          Retirer admin
                        </button>
                      ) : (
                        <button className="btn btn-ghost small" onClick={() => setRole(p, 'admin')}>
                          Passer admin
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
