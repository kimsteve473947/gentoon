'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TestAuthPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    checkUser()
    
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth Event:', event)
      console.log('Session:', session)
      setUser(session?.user ?? null)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  async function checkUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      setUser(user)
    } catch (error: any) {
      console.error('Error checking user:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function signInWithGoogle() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      console.log('OAuth response:', data)
    } catch (error: any) {
      console.error('Error signing in with Google:', error)
      setError(error.message)
    }
  }

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
    } catch (error: any) {
      console.error('Error signing out:', error)
      setError(error.message)
    }
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Supabase Auth Test Page</h1>
      
      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2 className="font-semibold mb-2">Connection Status:</h2>
        <p>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
        <p>Anon Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20)}...</p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      {user ? (
        <div className="bg-green-100 p-4 rounded mb-4">
          <h2 className="font-semibold mb-2">Logged in as:</h2>
          <pre className="text-sm overflow-auto">{JSON.stringify(user, null, 2)}</pre>
          <button
            onClick={signOut}
            className="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div className="bg-blue-100 p-4 rounded mb-4">
          <h2 className="font-semibold mb-2">Not logged in</h2>
          <button
            onClick={signInWithGoogle}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Sign in with Google
          </button>
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-semibold mb-2">Debug Console:</h2>
        <div className="bg-gray-800 text-green-400 p-4 rounded font-mono text-sm">
          <p>Check browser console for detailed logs</p>
        </div>
      </div>
    </div>
  )
}