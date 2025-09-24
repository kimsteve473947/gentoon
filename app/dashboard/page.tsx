'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StorageUsage } from '@/components/dashboard/storage-usage'
import { 
  LayoutDashboard, 
  FolderOpen, 
  Sparkles, 
  TrendingUp,
  Plus,
  ArrowRight,
  Crown,
  Image,
  Clock
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

interface DashboardStats {
  projectCount: number
  tokenBalance: number
  storageUsed: number
  recentProjects: Array<{
    id: string
    title: string
    createdAt: string
    panelCount: number
  }>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 사용자 데이터 가져오기
      const { data: userData } = await supabase
        .from('user')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!userData) return

      // 프로젝트 통계
      const { data: projects, count } = await supabase
        .from('project')
        .select('id, title, createdAt', { count: 'exact' })
        .eq('userId', userData.id)
        .is('deletedAt', null)
        .order('createdAt', { ascending: false })
        .limit(5)

      // 패널 수 가져오기
      const projectsWithPanels = await Promise.all(
        (projects || []).map(async (project) => {
          const { count: panelCount } = await supabase
            .from('panel')
            .select('*', { count: 'exact', head: true })
            .eq('projectId', project.id)

          return {
            ...project,
            panelCount: panelCount || 0
          }
        })
      )

      setStats({
        projectCount: count || 0,
        tokenBalance: 0, // TODO: 토큰 잔액 API 연동
        storageUsed: 0, // StorageUsage 컴포넌트에서 별도 처리
        recentProjects: projectsWithPanels
      })
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <LayoutDashboard className="h-8 w-8 text-purple-600" />
                대시보드
              </h1>
              <p className="text-gray-600 mt-2">
                웹툰 제작 현황을 한눈에 확인하세요
              </p>
            </div>
            <Link href="/studio">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                <Plus className="h-4 w-4 mr-2" />
                새 프로젝트
              </Button>
            </Link>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 프로젝트 수 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                전체 프로젝트
              </CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.projectCount || 0}</div>
              <p className="text-xs text-muted-foreground">
                활성 프로젝트
              </p>
            </CardContent>
          </Card>

          {/* 토큰 잔액 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                토큰 잔액
              </CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.tokenBalance?.toLocaleString() || '0'}
              </div>
              <Link href="/pricing" className="text-xs text-purple-600 hover:text-purple-700">
                토큰 충전하기 →
              </Link>
            </CardContent>
          </Card>

          {/* 멤버십 상태 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                멤버십
              </CardTitle>
              <Crown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">무료</div>
              <Link href="/pricing" className="text-xs text-purple-600 hover:text-purple-700">
                업그레이드 →
              </Link>
            </CardContent>
          </Card>

          {/* 이번 달 생성 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                이번 달 생성
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                패널 생성됨
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 메인 콘텐츠 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 최근 프로젝트 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>최근 프로젝트</CardTitle>
                  <Link href="/projects">
                    <Button variant="ghost" size="sm">
                      전체 보기
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {stats?.recentProjects && stats.recentProjects.length > 0 ? (
                  <div className="space-y-4">
                    {stats.recentProjects.map((project) => (
                      <Link 
                        key={project.id}
                        href={`/studio?projectId=${project.id}`}
                        className="block"
                      >
                        <div className="flex items-center justify-between p-4 rounded-lg border hover:border-purple-300 hover:bg-purple-50/50 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                              <Image className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                              <h3 className="font-medium">{project.title}</h3>
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span>{project.panelCount}개 패널</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(project.createdAt), { 
                                    addSuffix: true, 
                                    locale: ko 
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <FolderOpen className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 mb-4">
                      아직 프로젝트가 없습니다
                    </p>
                    <Link href="/studio">
                      <Button size="sm">
                        첫 프로젝트 만들기
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 스토리지 사용량 */}
          <div>
            <StorageUsage />
          </div>
        </div>
      </div>
    </div>
  )
}