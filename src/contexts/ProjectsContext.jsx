import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const ProjectsContext = createContext(null)

export function ProjectsProvider({ children }) {
  const { session } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const userId = session?.user?.id
    if (!userId) {
      setProjects([])
      setLoading(false)
      return
    }
    // On liste UNIQUEMENT les projets dont l'utilisateur est membre (créés ou invité),
    // y compris pour l'admin : sa vue globale est réservée à la page Admin.
    const { data, error } = await supabase
      .from('project_members')
      .select('project:projects(*)')
      .eq('user_id', userId)
    if (!error) {
      const list = (data ?? []).map((r) => r.project).filter(Boolean)
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      setProjects(list)
    }
    setLoading(false)
  }, [session])

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
