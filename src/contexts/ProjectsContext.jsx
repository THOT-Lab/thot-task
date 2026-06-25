import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const ProjectsContext = createContext(null)

export function ProjectsProvider({ children }) {
  const { session } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    // RLS ne renvoie que les projets dont l'utilisateur est membre (l'admin voit tout).
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: true })
    if (!error) setProjects(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (session) reload()
    else {
      setProjects([])
      setLoading(false)
    }
  }, [session, reload])

  return (
    <ProjectsContext.Provider value={{ projects, loading, reload }}>
      {children}
    </ProjectsContext.Provider>
  )
}

export function useProjects() {
  const ctx = useContext(ProjectsContext)
  if (!ctx) throw new Error('useProjects doit être utilisé dans <ProjectsProvider>')
  return ctx
}
