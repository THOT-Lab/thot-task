import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // Message clair en console si les variables ne sont pas renseignées.
  console.error(
    "[THOT Tasks] Variables Supabase manquantes. Copie .env.example en .env " +
      'et renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY, puis relance le serveur.'
  )
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'public-anon-key')
