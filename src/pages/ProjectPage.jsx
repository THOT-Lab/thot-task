import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProjects } from '../contexts/ProjectsContext'
import TaskRow from '../components/TaskRow'
import MembersPanel from '../components/MembersPanel'
import Modal from '../components/Modal'

export default function ProjectPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { reload: reloadProjects } = useProjects()

  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [nameDraft, setNameDraft] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [showMembers, setShowMembers] = useState(false)

  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [opError, setOpError] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [draggedId, setDraggedId] = useState(null)
  const commentRef = useRef(null)

  const growComment = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const loadProject = useCallback(async () => {
    const { data } = await supabase.from('projects').select('*').eq('id', id).maybeSingle()
    if (!data) {
      setNotFound(true)
      return
    }
    setProject(data)
    setNameDraft(data.name)
  }, [id])

  const loadTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
    setTasks(data ?? [])
  }, [id])

  const loadMembers = useCallback(async () => {
    const { data } = await supabase
      .from('project_members')
      .select('profiles(id, full_name, email)')
      .eq('project_id', id)
    setMembers((data ?? []).map((r) => r.profiles).filter(Boolean))
    const { data: inv } = await supabase
      .from('project_invitations')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true })
    setInvitations(inv ?? [])
  }, [id])

  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    Promise.all([loadProject(), loadTasks(), loadMembers()]).then(() => setLoading(false))
  }, [id, loadProject, loadTasks, loadMembers])

  // Initialise le commentaire quand on entre dans un projet (sans écraser la saisie en cours).
  useEffect(() => {
    setNotesDraft(project?.notes || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id])

  useEffect(() => {
    growComment(commentRef.current)
  }, [notesDraft])

  // --- Projet ---
  const saveName = async () => {
    setEditingName(false)
    const v = nameDraft.trim()
    if (!v || v === project?.name) {
      setNameDraft(project?.name || '')
      return
    }
    await supabase.from('projects').update({ name: v }).eq('id', id)
    await loadProject()
    reloadProjects()
  }

  const saveNotes = async () => {
    if (!project || notesDraft === (project.notes || '')) return
    setNotesSaving(true)
    const { error } = await supabase.from('projects').update({ notes: notesDraft }).eq('id', id)
    setNotesSaving(false)
    if (error) {
      console.error('[commentaire]', error)
      setOpError(error.message)
      return
    }
    setOpError('')
    setProject((p) => ({ ...p, notes: notesDraft }))
  }

  // --- Tâches ---
  // Exécute une opération et rend toute erreur visible (plus de échec silencieux).
  const mutate = async (query) => {
    const { error } = await query
    if (error) {
      console.error('[tâche]', error)
      setOpError(error.message)
      return
    }
    setOpError('')
    loadTasks()
  }

  const addTask = (title) => {
    const v = (title || '').trim()
    if (!v) return
    return mutate(
      supabase.from('tasks').insert({
        project_id: id,
        title: v,
        created_by: user.id,
        position: tasks.length,
      })
    )
  }
  const toggleTask = (t) =>
    mutate(supabase.from('tasks').update({ is_done: !t.is_done }).eq('id', t.id))
  const renameTask = (t, title) =>
    mutate(supabase.from('tasks').update({ title }).eq('id', t.id))
  const assignTask = (t, uid) =>
    mutate(supabase.from('tasks').update({ assigned_to: uid }).eq('id', t.id))
  const tagTask = (t, tag) => mutate(supabase.from('tasks').update({ tag }).eq('id', t.id))
  const deleteTask = (t) => {
    if (!confirm("Supprimer définitivement cette tâche ? (Pour garder l'historique, coche-la plutôt.)"))
      return
    return mutate(supabase.from('tasks').delete().eq('id', t.id))
  }
  // Glisser-déposer pour réordonner les tâches (priorité). On dépose la tâche
  // tirée à l'emplacement de la tâche survolée, puis on persiste les positions.
  const onDropTask = async (target) => {
    const srcId = draggedId
    setDraggedId(null)
    if (!srcId || srcId === target.id) return
    const ordered = [...tasks]
    const from = ordered.findIndex((t) => t.id === srcId)
    const to = ordered.findIndex((t) => t.id === target.id)
    if (from < 0 || to < 0) return
    const [moved] = ordered.splice(from, 1)
    ordered.splice(to, 0, moved)
    setTasks(ordered) // retour visuel immédiat
    const updates = ordered
      .map((t, i) => (t.position === i ? null : { id: t.id, i }))
      .filter(Boolean)
    await Promise.all(
      updates.map((u) => supabase.from('tasks').update({ position: u.i }).eq('id', u.id))
    )
    loadTasks()
  }

  const tagOptions = useMemo(
    () =>
      Array.from(new Set(tasks.map((t) => (t.tag || '').trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [tasks]
  )

  // Rang général (position absolue dans la liste complète), conservé même filtré.
  const rankById = useMemo(() => {
    const m = {}
    tasks.forEach((t, i) => {
      m[t.id] = i + 1
    })
    return m
  }, [tasks])

  const visibleTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (!filterAssignee || t.assigned_to === filterAssignee) &&
          (!filterTag || (t.tag || '') === filterTag)
      ),
    [tasks, filterAssignee, filterTag]
  )

  if (loading) return <div className="page muted">Chargement du projet…</div>
  if (notFound)
    return (
      <div className="page">
        <div className="empty-card">Projet introuvable ou accès non autorisé.</div>
      </div>
    )

  const pending = tasks.filter((t) => !t.is_done).length

  return (
    <div className="page">
      <div className="page-head">
        <div className="project-title">
          {editingName ? (
            <input
              className="project-name-input editing"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') {
                  setNameDraft(project.name)
                  setEditingName(false)
                }
              }}
            />
          ) : (
            <h1 className="project-h1">
              {project.name}
              <button
                className="pencil-btn"
                onClick={() => {
                  setNameDraft(project.name)
                  setEditingName(true)
                }}
                title="Renommer le projet"
                aria-label="Renommer le projet"
              >
                ✎
              </button>
            </h1>
          )}
          <p className="muted">
            {pending} tâche(s) en suspens · {members.length} membre(s)
          </p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary" onClick={() => setShowMembers(true)}>
            👥 Partenaires ({members.length + invitations.length})
          </button>
          <div className="partners-mini">
            {members.map((m) => (
              <span key={m.id} className="partner-mini" title={m.email}>
                {m.full_name || m.email}
              </span>
            ))}
            {invitations.map((inv) => (
              <span key={inv.id} className="partner-mini pending" title="Invitation en attente">
                {inv.email} (en attente)
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="task-table">
        {opError && (
          <div className="alert alert-error op-error">
            ⚠️ {opError}
            {/(does not exist|column)/i.test(opError) &&
              ' — une colonne manque dans la base : exécute la commande SQL fournie dans Supabase.'}
          </div>
        )}
        <div className="list-toolbar">
          <span className="t-num" />
          <span className="t-reorder" />
          <span className="t-check" />
          <span className="t-title muted small">Tâche</span>
          <select
            className="cell-select filter-assignee"
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            title="Filtrer par personne"
          >
            <option value="">In charge : tous</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name || m.email}
              </option>
            ))}
          </select>
          <select
            className="cell-select filter-tag"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            title="Filtrer par tag"
          >
            <option value="">Tag : tous</option>
            {tagOptions.map((tg) => (
              <option key={tg} value={tg}>
                {tg}
              </option>
            ))}
          </select>
          <span className="t-del" />
        </div>

        <ul className="task-list">
          {visibleTasks.map((t) => (
            <TaskRow
              key={t.id}
              num={rankById[t.id]}
              task={t}
              members={members}
              tagOptions={tagOptions}
              onToggle={toggleTask}
              onRename={renameTask}
              onAssign={assignTask}
              onTag={tagTask}
              onDelete={deleteTask}
              onDragStartTask={(t) => setDraggedId(t.id)}
              onDragEndTask={() => setDraggedId(null)}
              onDropTask={onDropTask}
            />
          ))}
          {visibleTasks.length === 0 && (
            <li className="muted empty-row">
              {tasks.length === 0 ? 'Aucune tâche pour le moment.' : 'Aucune tâche pour ce filtre.'}
            </li>
          )}
        </ul>

        <AddTaskInline onAdd={addTask} />
      </div>

      <section className="comment-card">
        <div className="comment-head">
          <h3 className="group-name">Commentaire</h3>
          {notesSaving && <span className="muted small">enregistrement…</span>}
        </div>
        <textarea
          ref={commentRef}
          className="comment-area"
          value={notesDraft}
          onChange={(e) => {
            setNotesDraft(e.target.value)
            growComment(e.target)
          }}
          onBlur={saveNotes}
          placeholder="Notes et commentaires communs au projet… (enregistré automatiquement en quittant le champ)"
        />
      </section>

      {showMembers && (
        <Modal title={`Partenaires — ${project.name}`} onClose={() => setShowMembers(false)} width="520px">
          <MembersPanel
            project={project}
            members={members}
            invitations={invitations}
            currentUserId={user.id}
            onChanged={loadMembers}
          />
        </Modal>
      )}
    </div>
  )
}

function AddTaskInline({ onAdd }) {
  const [v, setV] = useState('')
  const submit = (e) => {
    e.preventDefault()
    if (!v.trim()) return
    onAdd(v)
    setV('')
  }
  return (
    <form className="add-task-row" onSubmit={submit}>
      <span className="add-plus">+</span>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Ajouter une tâche…" />
    </form>
  )
}
