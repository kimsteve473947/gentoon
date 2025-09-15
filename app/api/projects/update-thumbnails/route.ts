import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 🚀 모든 프로젝트의 썸네일과 패널개수를 일괄 업데이트
    const { data: projects, error: projectError } = await supabase
      .from('project')
      .select(`
        id,
        thumbnailUrl,
        panelCount,
        panel (
          id,
          order,
          imageUrl
        )
      `)

    if (projectError) {
      console.error('프로젝트 조회 에러:', projectError)
      return NextResponse.json(
        { error: '프로젝트 조회에 실패했습니다.' }, 
        { status: 500 }
      )
    }

    let updatedCount = 0

    // 🚀 각 프로젝트의 썸네일과 패널개수를 계산하여 저장
    for (const project of projects) {
      const panels = project.panel || []
      const panelCount = panels.length
      
      // 첫 번째 이미지가 있는 패널 찾기
      const firstImagePanel = panels
        .sort((a, b) => a.order - b.order)
        .find(panel => panel.imageUrl && panel.imageUrl.trim() !== '')
      
      const thumbnailUrl = firstImagePanel?.imageUrl || null
      
      // 현재 값과 다른 경우만 업데이트
      if (project.thumbnailUrl !== thumbnailUrl || project.panelCount !== panelCount) {
        const { error: updateError } = await supabase
          .from('project')
          .update({ 
            thumbnailUrl,
            panelCount,
            updatedAt: new Date().toISOString()
          })
          .eq('id', project.id)

        if (!updateError) {
          updatedCount++
        } else {
          console.error(`프로젝트 ${project.id} 업데이트 실패:`, updateError)
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `${updatedCount}개 프로젝트의 썸네일과 패널개수가 업데이트되었습니다.`,
      updatedCount,
      totalProjectsChecked: projects.length
    })
    
  } catch (error) {
    console.error('썸네일 업데이트 실패:', error)
    return NextResponse.json(
      { error: '썸네일 업데이트에 실패했습니다.' }, 
      { status: 500 }
    )
  }
}

// 특정 프로젝트의 썸네일 업데이트
export async function PATCH(request: NextRequest) {
  try {
    const { projectId } = await request.json()
    
    if (!projectId) {
      return NextResponse.json({ error: 'projectId가 필요합니다.' }, { status: 400 })
    }

    const updateQuery = `
      UPDATE project 
      SET "thumbnailUrl" = (
        SELECT pa.image_url 
        FROM panel pa 
        WHERE pa.project_id = $1 
          AND pa.image_url IS NOT NULL 
          AND pa.image_url != ''
        ORDER BY pa."order" ASC 
        LIMIT 1
      ),
      "updatedAt" = NOW()
      WHERE id = $1 
        AND EXISTS (
          SELECT 1 FROM panel pa 
          WHERE pa.project_id = $1 
            AND pa.image_url IS NOT NULL 
            AND pa.image_url != ''
        );
    `
    
    await mcp__supabase_trumpettour__execute_sql(updateQuery.replace('$1', `'${projectId}'`))
    
    return NextResponse.json({ 
      success: true, 
      message: '프로젝트 썸네일이 업데이트되었습니다.' 
    })
    
  } catch (error) {
    console.error('개별 썸네일 업데이트 실패:', error)
    return NextResponse.json(
      { error: '썸네일 업데이트에 실패했습니다.' }, 
      { status: 500 }
    )
  }
}