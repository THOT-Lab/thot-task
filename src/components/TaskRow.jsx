import { useEffect, useRef, useState } from 'react'

export default function TaskRow({
  task,
  members,
  tagOptions = [],
  onToggle,
  onRename,
  onAssign,
  onTag,
  onDelete,
  onDragStartTask,
  onDragEndTask,
  onDropTask,
}) {
  const [title, setTitle] = useState(task.title)
  const [creatingTag, setCreatingTag] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [isOver, setIsOver] = useState(false)
  const liRef = useRef(null)

  useEffect(() => {
    setTitle(task.title)
  }, [task.title])

  const saveTitle = () => {
    const v = title.trim()
    if (v && v !== task.title) onRename(task, v)
    else setTitle(task.title)
  }

  const handleTagSelect = (e) => {
    const val = e.target.value
    if (val === '__new__') {
      setNewTag('')
      setCreatingTag(true)
      return
    }
    onTag(task, val)
  }

  const saveNewTag = () => {
    const clean = newTag.trim()
    setCreatingTag(false)
    if (clean && clean !== (task.tag || '')) onTag(task, clean)
  }

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', task.id)
    // Fantôme de glissement = la ligne entière
    if (liRef.current) e.dataTransfer.setDragImage(liRef.current, 24, 16)
    onDragStartTask?.(task)
  }

  return (
    <li
      ref={liRef}
      className={`task-row ${task.is_done ? 'done' : ''} ${isOver ? 'drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (!isOver) setIsOver(true)
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsOver(false)
        onDropTask?.(task)
      }}
    >
      <span
        className="drag-handle"
        draggable
        onDragStart={handleDragStart}
        onDragEnd={() => onDragEndTask?.()}
        title="Glisser pour déplacer (priorité)"
        aria-label="Déplacer la tâche"
      >
        ⠿
      </span>

      <button
        className={`check ${task.is_done ? 'checked' : ''}`}
        onClick={() => onToggle(task)}
        aria-label={task.is_done ? 'Rouvrir' : 'Terminer'}
        title={task.is_done ? 'Rouvrir la tâche' : 'Marquer comme faite'}
      >
        {task.is_done ? '✓' : ''}
      </button>

      <input
        className="task-title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitle}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />

      <select
        className={`cell-select assignee-select ${task.assigned_to ? 'has-value' : ''}`}
        value={task.assigned_to || ''}
        onChange={(e) => onAssign(task, e.target.value || null)}
        title="In charge"
      >
        <option value="">— In charge —</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.full_name || m.email}
          </option>
        ))}
      </select>

      {creatingTag ? (
        <input
          className="cell-input tag-input"
          autoFocus
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onBlur={saveNewTag}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setCreatingTag(false)
          }}
          placeholder="Nom du tag…"
          title="Nouveau tag"
        />
      ) : (
        <select
          className={`cell-select tag-select ${task.tag ? 'has-value' : ''}`}
          value={task.tag || ''}
          onChange={handleTagSelect}
          title="Tag"
        >
          <option value="">— Tag —</option>
          {tagOptions.map((tg) => (
            <option key={tg} value={tg}>
              {tg}
            </option>
          ))}
          <option value="__new__">➕ Nouveau tag…</option>
        </select>
      )}

      <button
        className="icon-btn danger"
        onClick={() => onDelete(task)}
        aria-label="Supprimer"
        title="Supprimer définitivement"
      >
        ×
      </button>
    </li>
  )
}
