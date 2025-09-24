'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

export function UserMenu() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'SIGNED_OUT') {
        router.push('/')
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router])

  const handleSignOut = async () => {
    // 관리자 캐시 정리
    try {
      localStorage.removeItem('instaToon_adminAccess');
      console.log('🗑️ Admin cache cleared on logout');
    } catch (error) {
      console.warn('Failed to clear admin cache on logout:', error);
    }
    
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-8 w-24 rounded"></div>
  }

  if (!user) {
    return (
      <button
        onClick={() => router.push('/sign-in')}
        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
      >
        로그인
      </button>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        {user.user_metadata?.avatar_url && (
          <img
            src={user.user_metadata.avatar_url}
            alt="Avatar"
            className="w-8 h-8 rounded-full"
          />
        )}
        <span className="text-sm font-medium">
          {user.user_metadata?.name || user.email?.split('@')[0]}
        </span>
      </div>
      <button
        onClick={handleSignOut}
        className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
      >
        로그아웃
      </button>
    </div>
  )
}