import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase credentials missing:', {
      url: supabaseUrl ? 'present' : 'missing',
      key: supabaseAnonKey ? 'present' : 'missing'
    })
    throw new Error('Supabase credentials not found. Please check your environment variables.')
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

