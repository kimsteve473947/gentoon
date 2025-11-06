// ⚠️ CRITICAL: 모든 import를 동적으로 처리하여 빌드 타임 분석 방지
export async function createClient() {
  // cookies도 동적 import
  const { cookies } = await import('next/headers');
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