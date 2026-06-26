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
  const [families, setFamilies] = useState([])
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [nameDraft, setNameDraft] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [showMembers, setShowMembers] = useState(false)

  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterColor, setFilterColor] = useState('')
  const [opError, setOpError] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [draggedId, setDraggedId] = useState(null)
  const [draggedFamilyId, setDraggedFamilyId] = useState(null)
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

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
    return data ?? []
  }, [id])

  const loadTasks = useCallback(async () => {
    setTasks(await fetchTasks())
  }, [fetchTasks])

  // Charge les familles ; en crée une par défaut s'il n'y en a pas, et rattache
  // les tâches sans famille à la première famille (pour qu'aucune ne soit invisible).
  const loadFamilies = useCallback(async () => {
    const { data } = await supabase
      .from('task_groups')
      .select('*')
      .eq('project_id', id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
    let fams = data ?? []
    let tks = await fetchTasks()

    if (fams.length === 0) {
      const { data: nf } = await supabase
        .from('task_groups')
        .insert({ project_id: id, name: 'Tâches', position: 0 })
        .select()
        .single()
      if (nf) fams = [nf]
    }
    if (fams.length) {
      const orphans = tks.filter((t) => !t.group_id).map((t) => t.id)
      if (orphans.length) {
        await supabase.from('tasks').update({ group_id: fams[0].id }).in('id', orphans)
        tks = await fetchTasks()
      }
    }
    setFamilies(fams)
    setTasks(tks)
  }, [id, fetchTasks])

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
    Promise.all([loadProject(), loadFamilies(), loadMembers()]).then(() => setLoading(false))
  }, [id, loadProject, loadFamilies, loadMembers])

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
      setOpError(error.message)
      return
    }
    setOpError('')
    setProject((p) => ({ ...p, notes: notesDraft }))
  }

  // --- Familles ---
  const addFamily = async () => {
    await supabase
      .from('task_groups')
      .insert({ project_id: id, name: 'Nouvelle famille', position: families.length })
    loadFamilies()
  }
  const renameFamily = async (fam, name) => {
    await supabase.from('task_groups').update({ name }).eq('id', fam.id)
    loadFamilies()
  }
  const deleteFamily = async (fam) => {
    if (families.length <= 1) {
      alert('Il doit rester au moins une famille de tâches.')
      return
    }
    const target = families.find((f) => f.id !== fam.id)
    if (
      !confirm(
        `Supprimer la famille « ${fam.name} » ? Ses tâches seront déplacées dans « ${target.name} ».`
      )
    )
      return
    await supabase.from('tasks').update({ group_id: target.id }).eq('group_id', fam.id)
    await supabase.from('task_groups').delete().eq('id', fam.id)
    loadFamilies()
  }

  // --- Tâches ---
  const mutate = async (query) => {
    const { error } = await query
    if (error) {
      setOpError(error.message)
      return
    }
    setOpError('')
    loadTasks()
  }
  const addTask = (familyId, title) => {
    const v = (title || '').trim()
    if (!v) return
    const count = tasks.filter((t) => t.group_id === familyId).length
    return mutate(
      supabase.from('tasks').insert({
        project_id: id,
        group_id: familyId,
        title: v,
        created_by: user.id,
        position: count,
      })
    )
  }
  const toggleTask = (t) =>
    mutate(supabase.from('tasks').update({ is_done: !t.is_done }).eq('id', t.id))
  const renameTask = (t, title) =>
    mutate(supabase.from('tasks').update({ title }).eq('id', t.id))
  const assignTask = (t, uid) =>
    mutate(supabase.from('tasks').update({ assigned_to: uid }).eq('id', t.id))
  const colorTask = (t, color) =>
    mutate(supabase.from('tasks').update({ color }).eq('id', t.id))
  const deleteTask = (t) => {
    if (!confirm("Supprimer définitivement cette tâche ? (Pour garder l'historique, coche-la plutôt.)"))
      return
    return mutate(supabase.from('tasks').delete().eq('id', t.id))
  }

  // Glisser-déposer : la tâche tirée prend la famille + la place de la tâche survolée.
  const onDropTask = async (target) => {
    const srcId = draggedId
    setDraggedId(null)
    if (!srcId || srcId === target.id) return
    const fam = target.group_id
    const list = tasks.filter((t) => t.group_id === fam && t.id !== srcId)
    const idx = list.findIndex((t) => t.id === target.id)
    const src = tasks.find((t) => t.id === srcId)
    if (idx < 0 || !src) return
    list.splice(idx, 0, src)
    await Promise.all([
      supabase.from('tasks').update({ group_id: fam }).eq('id', srcId),
      ...list.map((t, i) => supabase.from('tasks').update({ position: i }).eq('id', t.id)),
    ])
    loadTasks()
  }

  // Réordonner les familles : la famille tirée s'insère AVANT la famille survolée
  // (la ligne d'insertion apparaît donc juste au-dessus de la cible).
  const onDropFamily = async (target) => {
    const srcId = draggedFamilyId
    setDraggedFamilyId(null)
    if (!srcId || srcId === target.id) return
    const moved = families.find((f) => f.id === srcId)
    if (!moved) return
    const without = families.filter((f) => f.id !== srcId)
    const to = without.findIndex((f) => f.id === target.id)
    if (to < 0) return
    without.splice(to, 0, moved)
    setFamilies(without) // retour visuel immédiat
    await Promise.all(
      without
        .map((f, i) => (f.position === i ? null : { id: f.id, i }))
        .filter(Boolean)
        .map((u) => supabase.from('task_groups').update({ position: u.i }).eq('id', u.id))
    )
    loadFamilies()
  }

  const tasksByFamily = useMemo(() => {
    const m = {}
    for (const f of families) m[f.id] = []
    for (const t of tasks) if (m[t.group_id]) m[t.group_id].push(t)
    for (const k in m)
      m[k].sort(
        (a, b) => a.position - b.position || new Date(a.created_at) - new Date(b.created_at)
      )
    return m
  }, [families, tasks])

  const rankById = useMemo(() => {
    const m = {}
    for (const f of families) (tasksByFamily[f.id] || []).forEach((t, i) => (m[t.id] = i + 1))
    return m
  }, [families, tasksByFamily])

  const matchesFilter = (t) =>
    (!filterAssignee || t.assigned_to === filterAssignee) &&
    (!filterColor || (t.color || '') === filterColor)

  if (loading) return <div className="page muted">Chargement du projet…</div>
  if (notFound)
    return (
      <div className="page">
        <div className="empty-card">Projet introuvable ou accès non autorisé.</div>
      </div>
    )

  const pending = tasks.filter((t) => !t.is_done).length
  const familyDragging = draggedFamilyId != null
  const dnd = {
    onDragStartTask: (t) => setDraggedId(t.id),
    onDragEndTask: () => setDraggedId(null),
    onDropTask,
    familyDragging,
  }
  const familyDnd = {
    onDragStartFamily: (f) => setDraggedFamilyId(f.id),
    onDragEndFamily: () => setDraggedFamilyId(null),
    onDropFamily,
  }
  const taskHandlers = {
    onToggle: toggleTask,
    onRename: renameTask,
    onAssign: assignTask,
    onColor: colorTask,
    onDelete: deleteTask,
  }

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

      {opError && (
        <div className="alert alert-error op-error">
          ⚠️ {opError}
          {/(does not exist|column)/i.test(opError) &&
            ' — une colonne manque dans la base : exécute la commande SQL fournie.'}
        </div>
      )}

      {/* Filtres globaux, alignés au-dessus des colonnes (sans encadré) */}
      <div className="filter-bar">
        <div className="list-toolbar">
          <span className="t-num" />
          <span className="t-reorder" />
          <span className="t-check" />
          <span className="t-title" />
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
            className={`cell-select filter-color color-${filterColor || 'none'}`}
            value={filterColor}
            onChange={(e) => setFilterColor(e.target.value)}
            title="Filtrer par couleur"
          >
            <option value="">—</option>
            <option value="blue">🔵</option>
            <option value="orange">🟠</option>
            <option value="red">🔴</option>
          </select>
          <span className="t-del" />
        </div>
      </div>

      {families.map((fam) => (
        <FamilyBox
          key={fam.id}
          family={fam}
          tasks={(tasksByFamily[fam.id] || []).filter(matchesFilter)}
          totalCount={(tasksByFamily[fam.id] || []).length}
          members={members}
          rankById={rankById}
          dnd={dnd}
          familyDnd={familyDnd}
          familyDragging={familyDragging}
          taskHandlers={taskHandlers}
          canDelete={families.length > 1}
          onRename={renameFamily}
          onDelete={deleteFamily}
          onAddTask={addTask}
        />
      ))}

      <button className="add-family" onClick={addFamily}>
        <span className="add-card-plus">+</span> Ajouter une famille de tâches
      </button>

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

function FamilyBox({
  family,
  tasks,
  totalCount,
  members,
  rankById,
  dnd,
  familyDnd,
  familyDragging,
  taskHandlers,
  canDelete,
  onRename,
  onDelete,
  onAddTask,
}) {
  const [name, setName] = useState(family.name)
  const [isOver, setIsOver] = useState(false)
  const boxRef = useRef(null)
  useEffect(() => setName(family.name), [family.name])

  return (
    <section
      ref={boxRef}
      className={`task-table family-box ${isOver ? 'fam-drag-over' : ''}`}
      onDragOver={(e) => {
        if (!familyDragging) return
        e.preventDefault()
        if (!isOver) setIsOver(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return
        setIsOver(false)
      }}
      onDrop={(e) => {
        if (!familyDragging) return
        e.preventDefault()
        setIsOver(false)
        familyDnd.onDropFamily?.(family)
      }}
    >
      <div className="family-head">
        <span
          className="drag-handle family-drag"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            if (boxRef.current) e.dataTransfer.setDragImage(boxRef.current, 30, 20)
            familyDnd.onDragStartFamily?.(family)
          }}
          onDragEnd={() => familyDnd.onDragEndFamily?.()}
          title="Glisser pour réordonner les familles"
          aria-label="Déplacer la famille"
        >
          ⠿
        </span>
        <input
          className="family-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const v = name.trim()
            if (v && v !== family.name) onRename(family, v)
            else setName(family.name)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          title="Cliquer pour renommer la famille"
        />
        <span className="muted small">{totalCount}</span>
        {canDelete && (
          <button
            className="icon-btn danger"
            onClick={() => onDelete(family)}
            title="Supprimer la famille"
          >
            ×
          </button>
        )}
      </div>

      <ul className="task-list">
        {tasks.map((t) => (
          <TaskRow
            key={t.id}
            num={rankById[t.id]}
            task={t}
            members={members}
            {...taskHandlers}
            {...dnd}
          />
        ))}
        {tasks.length === 0 && <li className="empty-row muted">Aucune tâche.</li>}
      </ul>

      <AddTaskInline onAdd={(title) => onAddTask(family.id, title)} />
    </section>
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
