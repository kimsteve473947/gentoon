'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Settings, 
  LogOut,
  ChevronDown,
  FolderOpen,
  Shield,
  User
} from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export function Header() {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    // 사용자 정보 가져오기
    const getUser = async () => {
      try {
        // 실제 사용자 인증 확인

        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error('Error fetching user:', error)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    // 인증 상태 변경 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [mounted])

  const handleSignOut = async () => {
    try {
      // 먼저 로컬 세션 클리어
      await supabase.auth.signOut()
      
      // 모든 쿠키 제거를 위한 추가 처리
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      // 홈으로 리다이렉트
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // 사용자 이름 또는 이메일에서 이니셜 추출
  const getUserInitials = () => {
    if (!user) return '김중휘'
    const name = user.user_metadata?.full_name || user.user_metadata?.name
    if (name) {
      return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return user.email?.slice(0, 2).toUpperCase() || '김중휘'
  }

  // 사용자 표시 이름 가져오기
  const getUserDisplayName = () => {
    if (!user) return '김중휘'
    return user.user_metadata?.full_name || 
           user.user_metadata?.name || 
           user.email?.split('@')[0] || 
           '김중휘'
  }

  // 프로필 이미지 URL 가져오기 (고해상도)
  const getUserAvatarUrl = () => {
    if (!user) return null
    
    const avatarUrl = user.user_metadata?.avatar_url
    const pictureUrl = user.user_metadata?.picture
    
    console.log('🖼️ Profile Image Debug:', {
      provider: user.user_metadata?.provider,
      avatarUrl,
      pictureUrl,
      allMetadata: user.user_metadata
    })
    
    if (avatarUrl) {
      // Google 프로필 이미지 처리
      if (avatarUrl.includes('googleusercontent.com')) {
        return avatarUrl.replace(/s\d+-c/, 's200-c')
      }
      // 카카오 프로필 이미지는 HTTPS로 변환
      if (avatarUrl.includes('kakaocdn.net') || avatarUrl.includes('kakao.com')) {
        return avatarUrl.replace('http://', 'https://')
      }
      // 기타 프로필 이미지는 그대로 사용
      return avatarUrl
    }
    
    if (pictureUrl) {
      // Google 이미지 URL의 크기를 더 크게 변경
      if (pictureUrl.includes('googleusercontent.com')) {
        return pictureUrl.replace(/s\d+-c/, 's200-c')
      }
      // 카카오 프로필 이미지는 HTTPS로 변환
      if (pictureUrl.includes('kakaocdn.net') || pictureUrl.includes('kakao.com')) {
        return pictureUrl.replace('http://', 'https://')
      }
      // 기타 이미지는 그대로 사용
      return pictureUrl
    }
    
    return null
  }

  // 관리자 권한 확인
  const isAdmin = () => {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
    return user?.email === adminEmail
  }

  // 특정 페이지에서는 헤더를 숨김
  const hideHeader = ['/sign-in', '/sign-up', '/studio'].includes(pathname)
  if (hideHeader) return null

  // 클라이언트에서만 렌더링
  if (!mounted) {
    return (
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <img 
                src="/gentoon.webp" 
                alt="GenToon" 
                className="h-10 w-10 object-contain"
              />
              <span className="text-2xl font-bold">GenToon</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <img 
              src="/gentoon.webp" 
              alt="GenToon" 
              className="h-10 w-10 object-contain"
            />
            <span className="text-2xl font-bold">GenToon</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link 
              href="/gallery" 
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              갤러리
            </Link>

            <Link 
              href="/pricing" 
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              멤버십
            </Link>
            
            <Link 
              href="/studio" 
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              스튜디오
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {loading ? (
            <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
          ) : user || true ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 hover:bg-muted px-2 py-1 rounded-md outline-none">
                  <Avatar className="h-8 w-8">
                    <AvatarImage 
                      src={getUserAvatarUrl()} 
                      alt={getUserDisplayName()}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-gradient-to-br from-purple-600 to-pink-600 text-white text-xs">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-sm font-medium max-w-[150px] truncate">
                    {getUserDisplayName()}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      안녕하세요, {getUserDisplayName()}님!
                    </p>
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {user?.email || 'kimjh473947@gmail.com'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href="/projects" className="cursor-pointer">
                    <FolderOpen className="mr-2 h-4 w-4" />
                    <span>작업내역</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>마이페이지</span>
                  </Link>
                </DropdownMenuItem>
                {isAdmin() && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin-473947" className="cursor-pointer text-red-600">
                      <Shield className="mr-2 h-4 w-4" />
                      <span>관리자 대시보드</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>로그아웃</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link href="/sign-in">로그인</Link>
              </Button>
              <Button asChild className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-full px-6">
                <Link href="/studio">
                  가입하기
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}