import { cookies } from 'next/headers'

export async function createClient() {
  // ⚠️ CRITICAL FIX: @supabase/ssr 동적 import로 Edge Runtime 에러 완전 방지
  // 빌드 타임에는 이 함수가 호출되지 않도록 하는 것이 최선이지만,
  // 만약 호출되면 동적 import로 처리하여 에러 방지

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