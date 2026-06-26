import { useEffect, useRef, useState } from 'react'

const COLORS = [
  { value: 'blue', label: '🔵 Bleu' },
  { value: 'orange', label: '🟠 Orange' },
  { value: 'red', label: '🔴 Rouge' },
]

export default function TaskRow({
  num,
  task,
  members,
  onToggle,
  onRename,
  onAssign,
  onColor,
  onDelete,
  onDragStartTask,
  onDragEndTask,
  onDropTask,
}) {
  const [title, setTitle] = useState(task.title)
  const [isOver, setIsOver] = useState(false)
  const liRef = useRef(null)
  const taRef = useRef(null)

  const autoGrow = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    setTitle(task.title)
  }, [task.title])
  useEffect(() => {
    autoGrow(taRef.current)
  }, [title])

  const saveTitle = () => {
    const v = title.trim()
    if (v && v !== task.title) onRename(task, v)
    else setTitle(task.title)
  }

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', task.id)
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
      <span className="task-num">{num}</span>

      <span
        className="drag-handle"
        draggable
        onDragStart={handleDragStart}
        onDragEnd={() => onDragEndTask?.()}
        title="Glisser pour déplacer (priorité / famille)"
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

      <textarea
        ref={taRef}
        className="task-title-input"
        rows={1}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          autoGrow(e.target)
        }}
        onBlur={saveTitle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
      />

      <select
        className={`cell-select assignee-select ${task.assigned_to ? 'has-value' : ''}`}
        value={task.assigned_to || ''}
        onChange={(e) => onAssign(task, e.target.value || null)}
        title="In charge"
      >
        <option value="">In charge</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.full_name || m.email}
          </option>
        ))}
      </select>

      <select
        className={`cell-select color-select color-${task.color || 'none'}`}
        value={task.color || ''}
        onChange={(e) => onColor(task, e.target.value)}
        title="Couleur"
      >
        <option value="">Couleur</option>
        {COLORS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

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
