import { cookies } from 'next/headers'

export async function createClient() {
  // ⚠️ CRITICAL FIX: Build 시에는 Supabase 연결 우회 (Edge Runtime 에러 방지)
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    // 빌드 타임에는 mock 클라이언트 반환
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
        update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
        delete: () => ({ eq: async () => ({ data: null, error: null }) })
      }),
      storage: {
        from: () => ({
          upload: async () => ({ data: null, error: null }),
          getPublicUrl: () => ({ data: { publicUrl: '' } })
        })
      }
    } as any;
  }

  // Runtime에서만 실제 Supabase 클라이언트 로드 (동적 import)
  const { createServerClient } = await import('@supabase/ssr');
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // 서버 컴포넌트에서는 쿠키 설정이 불가능할 수 있음
          }
        },
      },
    }
  )
}