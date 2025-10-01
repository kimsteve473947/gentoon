import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 🔍 전체 스키마 검증 API
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [Schema] 전체 데이터베이스 스키마 검증 시작...');
    
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const results = {
      generation: { status: 'unknown', missingColumns: [], error: null },
      subscription: { status: 'unknown', missingColumns: [], error: null },
      project: { status: 'unknown', missingColumns: [], error: null },
      panel: { status: 'unknown', missingColumns: [], error: null },
      character: { status: 'unknown', missingColumns: [], error: null }
    };

    // Generation 테이블 검증
    console.log('🔍 [Schema] 1. Generation 테이블 검증');
    try {
      // Expected columns from Prisma schema
      const expectedGenerationColumns = [
        'id', 'userId', 'projectId', 'panelId', 'characterId', 
        'prompt', 'negativePrompt', 'imageUrl', 'thumbnailUrl', 
        'model', 'tokensUsed', 'generationTime', 'metadata', 'createdAt'
      ];

      for (const column of expectedGenerationColumns) {
        const { data, error } = await supabase
          .from('generation')
          .select(column)
          .limit(1);

        if (error && error.message.includes(`column generation.${column} does not exist`)) {
          results.generation.missingColumns.push(column);
        }
      }

      if (results.generation.missingColumns.length === 0) {
        results.generation.status = 'complete';
        console.log('✅ [Schema] Generation 테이블: 모든 컬럼 존재');
      } else {
        results.generation.status = 'missing_columns';
        console.log(`❌ [Schema] Generation 테이블: ${results.generation.missingColumns.length}개 컬럼 누락`);
      }
    } catch (error: any) {
      results.generation.error = error.message;
      results.generation.status = 'error';
    }

    // Subscription 테이블 검증
    console.log('🔍 [Schema] 2. Subscription 테이블 검증');
    try {
      const expectedSubscriptionColumns = [
        'id', 'userId', 'plan', 'imageTokensTotal', 'imageTokensUsed', 
        'textTokensTotal', 'textTokensUsed', 'scriptGenerationsTotal', 
        'scriptGenerationsUsed', 'tokensTotal', 'tokensUsed', 'maxCharacters',
        'tossBillingKey', 'tossCustomerKey', 'paymentMethod', 'currentPeriodStart',
        'currentPeriodEnd', 'cancelAtPeriodEnd', 'tokensResetDate', 'nextTokensReset'
      ];

      for (const column of expectedSubscriptionColumns) {
        const { data, error } = await supabase
          .from('subscription')
          .select(column)
          .limit(1);

        if (error && error.message.includes(`column subscription.${column} does not exist`)) {
          results.subscription.missingColumns.push(column);
        }
      }

      if (results.subscription.missingColumns.length === 0) {
        results.subscription.status = 'complete';
        console.log('✅ [Schema] Subscription 테이블: 모든 컬럼 존재');
      } else {
        results.subscription.status = 'missing_columns';
        console.log(`❌ [Schema] Subscription 테이블: ${results.subscription.missingColumns.length}개 컬럼 누락`);
      }
    } catch (error: any) {
      results.subscription.error = error.message;
      results.subscription.status = 'error';
    }

    // Project 테이블 검증
    console.log('🔍 [Schema] 3. Project 테이블 검증');
    try {
      const expectedProjectColumns = [
        'id', 'userId', 'title', 'description', 'thumbnailUrl', 'panelCount',
        'lastPanelImageUrl', 'isEmpty', 'hasContent', 'contentSummary', 
        'lastEditedAt', 'status', 'isPublic', 'deletedAt', 'metadata',
        'createdAt', 'updatedAt', 'publishedAt'
      ];

      for (const column of expectedProjectColumns) {
        const { data, error } = await supabase
          .from('project')
          .select(column)
          .limit(1);

        if (error && error.message.includes(`column project.${column} does not exist`)) {
          results.project.missingColumns.push(column);
        }
      }

      if (results.project.missingColumns.length === 0) {
        results.project.status = 'complete';
        console.log('✅ [Schema] Project 테이블: 모든 컬럼 존재');
      } else {
        results.project.status = 'missing_columns';
        console.log(`❌ [Schema] Project 테이블: ${results.project.missingColumns.length}개 컬럼 누락`);
      }
    } catch (error: any) {
      results.project.error = error.message;
      results.project.status = 'error';
    }

    // Panel 테이블 검증
    console.log('🔍 [Schema] 4. Panel 테이블 검증');
    try {
      const expectedPanelColumns = [
        'id', 'projectId', 'order', 'prompt', 'imageUrl', 'editData',
        'createdAt', 'updatedAt'
      ];

      for (const column of expectedPanelColumns) {
        const { data, error } = await supabase
          .from('panel')
          .select(column)
          .limit(1);

        if (error && error.message.includes(`column panel.${column} does not exist`)) {
          results.panel.missingColumns.push(column);
        }
      }

      if (results.panel.missingColumns.length === 0) {
        results.panel.status = 'complete';
        console.log('✅ [Schema] Panel 테이블: 모든 컬럼 존재');
      } else {
        results.panel.status = 'missing_columns';
        console.log(`❌ [Schema] Panel 테이블: ${results.panel.missingColumns.length}개 컬럼 누락`);
      }
    } catch (error: any) {
      results.panel.error = error.message;
      results.panel.status = 'error';
    }

    // Character 테이블 검증
    console.log('🔍 [Schema] 5. Character 테이블 검증');
    try {
      const expectedCharacterColumns = [
        'id', 'userId', 'name', 'description', 'styleGuide', 
        'referenceImages', 'ratioImages', 'thumbnailUrl', 'metadata',
        'isPublic', 'isFavorite', 'createdAt', 'updatedAt'
      ];

      for (const column of expectedCharacterColumns) {
        const { data, error } = await supabase
          .from('character')
          .select(column)
          .limit(1);

        if (error && error.message.includes(`column character.${column} does not exist`)) {
          results.character.missingColumns.push(column);
        }
      }

      if (results.character.missingColumns.length === 0) {
        results.character.status = 'complete';
        console.log('✅ [Schema] Character 테이블: 모든 컬럼 존재');
      } else {
        results.character.status = 'missing_columns';
        console.log(`❌ [Schema] Character 테이블: ${results.character.missingColumns.length}개 컬럼 누락`);
      }
    } catch (error: any) {
      results.character.error = error.message;
      results.character.status = 'error';
    }

    // 전체 요약
    const totalMissingColumns = Object.values(results).reduce(
      (sum, table) => sum + table.missingColumns.length, 0
    );

    console.log(`🎯 [Schema] 스키마 검증 완료 - 총 ${totalMissingColumns}개 컬럼 누락`);

    return NextResponse.json({
      success: true,
      message: "스키마 검증 완료",
      summary: {
        totalMissingColumns,
        tablesWithIssues: Object.entries(results)
          .filter(([_, table]) => table.missingColumns.length > 0 || table.error)
          .length
      },
      results,
      requiredSqlCommands: generateSqlCommands(results)
    });

  } catch (error: any) {
    console.error('💥 [Schema] 전체 스키마 검증 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: "스키마 검증 중 오류 발생",
      details: error.message
    }, { status: 500 });
  }
}

function generateSqlCommands(results: any): string[] {
  const commands: string[] = [];

  // Generation 테이블 누락 컬럼
  if (results.generation.missingColumns.includes('tokensUsed')) {
    commands.push('ALTER TABLE generation ADD COLUMN IF NOT EXISTS "tokensUsed" INTEGER DEFAULT 2;');
  }
  if (results.generation.missingColumns.includes('generationTime')) {
    commands.push('ALTER TABLE generation ADD COLUMN IF NOT EXISTS "generationTime" INTEGER;');
  }

  // Subscription 테이블 누락 컬럼
  if (results.subscription.missingColumns.includes('imageTokensTotal')) {
    commands.push('ALTER TABLE subscription ADD COLUMN IF NOT EXISTS "imageTokensTotal" INTEGER DEFAULT 0;');
  }
  if (results.subscription.missingColumns.includes('imageTokensUsed')) {
    commands.push('ALTER TABLE subscription ADD COLUMN IF NOT EXISTS "imageTokensUsed" INTEGER DEFAULT 0;');
  }
  if (results.subscription.missingColumns.includes('textTokensTotal')) {
    commands.push('ALTER TABLE subscription ADD COLUMN IF NOT EXISTS "textTokensTotal" INTEGER DEFAULT 0;');
  }
  if (results.subscription.missingColumns.includes('textTokensUsed')) {
    commands.push('ALTER TABLE subscription ADD COLUMN IF NOT EXISTS "textTokensUsed" INTEGER DEFAULT 0;');
  }
  if (results.subscription.missingColumns.includes('scriptGenerationsTotal')) {
    commands.push('ALTER TABLE subscription ADD COLUMN IF NOT EXISTS "scriptGenerationsTotal" INTEGER DEFAULT 15;');
  }
  if (results.subscription.missingColumns.includes('scriptGenerationsUsed')) {
    commands.push('ALTER TABLE subscription ADD COLUMN IF NOT EXISTS "scriptGenerationsUsed" INTEGER DEFAULT 0;');
  }

  // Project 테이블 누락 컬럼
  if (results.project.missingColumns.includes('panelCount')) {
    commands.push('ALTER TABLE project ADD COLUMN IF NOT EXISTS "panelCount" INTEGER DEFAULT 0;');
  }
  if (results.project.missingColumns.includes('lastPanelImageUrl')) {
    commands.push('ALTER TABLE project ADD COLUMN IF NOT EXISTS "lastPanelImageUrl" TEXT;');
  }
  if (results.project.missingColumns.includes('isEmpty')) {
    commands.push('ALTER TABLE project ADD COLUMN IF NOT EXISTS "isEmpty" BOOLEAN DEFAULT true;');
  }
  if (results.project.missingColumns.includes('hasContent')) {
    commands.push('ALTER TABLE project ADD COLUMN IF NOT EXISTS "hasContent" BOOLEAN DEFAULT false;');
  }
  if (results.project.missingColumns.includes('contentSummary')) {
    commands.push('ALTER TABLE project ADD COLUMN IF NOT EXISTS "contentSummary" TEXT;');
  }
  if (results.project.missingColumns.includes('lastEditedAt')) {
    commands.push('ALTER TABLE project ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMP DEFAULT NOW();');
  }

  return commands;
}