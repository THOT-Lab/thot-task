import { useEffect, useState } from 'react'
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
    // BOM ﻿ pour que les accents s'affichent bien dans Excel
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `thot-task-inscrits-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="page muted">Chargement…</div>

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Administration</h1>
          <p className="muted">Vue globale des utilisateurs et des projets.</p>
        </div>
      </div>

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
                <th>Nom</th>
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

      <section>
        <h2 className="section-title">Projets ({projects.length})</h2>
        <div className="project-grid">
          {projects.map((p) => (
            <button
              key={p.id}
              className="project-card"
              onClick={() => navigate(`/project/${p.id}`)}
            >
              <h3>{p.name}</h3>
              {p.description && <p className="muted card-desc">{p.description}</p>}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
