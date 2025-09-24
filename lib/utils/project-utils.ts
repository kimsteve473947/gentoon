// 프로젝트 관련 유틸리티 함수들

export interface ProjectWithPanels {
  id: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  status: string
  createdAt: Date | string
  updatedAt: Date | string
  panels?: Array<{
    id: string
    order: number
    imageUrl: string | null
    prompt: string
  }>
}

/**
 * 프로젝트가 비어있는지 확인
 * - 패널이 없거나 모든 패널에 이미지가 없으면 빈 프로젝트
 */
export function isEmptyProject(project: ProjectWithPanels): boolean {
  if (!project.panels || project.panels.length === 0) {
    return true
  }
  
  return project.panels.every(panel => !panel.imageUrl || panel.imageUrl.trim() === '')
}

/**
 * 작업 중인 프로젝트인지 확인
 * - 최소 하나의 패널에 이미지가 있지만 완성되지 않은 프로젝트
 */
export function isWorkInProgressProject(project: ProjectWithPanels): boolean {
  if (isEmptyProject(project)) {
    return false
  }
  
  if (project.status === 'COMPLETED' || project.status === 'PUBLISHED') {
    return false
  }
  
  return true
}

/**
 * 완성된 프로젝트인지 확인
 */
export function isCompletedProject(project: ProjectWithPanels): boolean {
  return project.status === 'COMPLETED' || project.status === 'PUBLISHED'
}

/**
 * 프로젝트를 카테고리별로 분류
 */
export function categorizeProjects(projects: ProjectWithPanels[]) {
  const empty: ProjectWithPanels[] = []
  const inProgress: ProjectWithPanels[] = []
  const completed: ProjectWithPanels[] = []

  projects.forEach(project => {
    if (isEmptyProject(project)) {
      empty.push(project)
    } else if (isCompletedProject(project)) {
      completed.push(project)
    } else {
      inProgress.push(project)
    }
  })

  return { empty, inProgress, completed }
}

/**
 * 프로젝트의 첫 번째 이미지 URL을 썸네일로 반환
 */
export function getProjectThumbnail(project: ProjectWithPanels): string | null {
  // 기존 썸네일이 있으면 우선 사용
  if (project.thumbnailUrl) {
    return project.thumbnailUrl
  }
  
  // 첫 번째 패널의 이미지를 썸네일로 사용
  if (project.panels && project.panels.length > 0) {
    const firstImagePanel = project.panels
      .sort((a, b) => a.order - b.order)
      .find(panel => panel.imageUrl && panel.imageUrl.trim() !== '')
    
    return firstImagePanel?.imageUrl || null
  }
  
  return null
}

/**
 * 프로젝트 진행률 계산 (0-100)
 */
export function calculateProjectProgress(project: ProjectWithPanels): number {
  if (!project.panels || project.panels.length === 0) {
    return 0
  }
  
  const totalPanels = project.panels.length
  const completedPanels = project.panels.filter(panel => 
    panel.imageUrl && panel.imageUrl.trim() !== ''
  ).length
  
  return Math.round((completedPanels / totalPanels) * 100)
}

/**
 * 프로젝트 표시용 상태 텍스트
 */
export function getProjectStatusText(project: ProjectWithPanels): string {
  if (isEmptyProject(project)) {
    return '빈 프로젝트'
  }
  
  if (isCompletedProject(project)) {
    return project.status === 'PUBLISHED' ? '발행됨' : '완성됨'
  }
  
  const progress = calculateProjectProgress(project)
  return `작업 중 (${progress}%)`
}