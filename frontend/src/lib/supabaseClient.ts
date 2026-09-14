import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
// database.types.ts on generoitu komennolla:
//   supabase gen types typescript --linked > src/lib/database.types.ts
// Aja uudelleen aina kun supabase/migrations/ saa uusia tauluja/funktioita.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase-ympäristömuuttujat puuttuvat. Kopioi .env.example -> .env ja täytä VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.',
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
