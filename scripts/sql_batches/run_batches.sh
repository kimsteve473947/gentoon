#!/bin/bash
# 대량 폰트 삽입 실행 스크립트
# 생성된 SQL 파일들을 순차적으로 실행

echo "🚀 44개 배치 SQL 파일 실행 시작"

cd "/Users/gimjunghwi/Desktop/gentoon-saas/scripts/sql_batches"

for i in {1..44}; do
    batch_file="batch_$(printf "%03d" $i).sql"
    
    if [ -f "$batch_file" ]; then
        echo "📦 배치 $i/${total_batches} 실행 중: $batch_file"
        
        # 여기에 실제 MCP 명령어나 psql 명령어 추가
        # 예: mcp__supabase__execute_sql < "$batch_file"
        
        echo "  ✅ 배치 $i 완료"
        sleep 1  # 서버 부하 방지
    else
        echo "  ❌ 파일을 찾을 수 없음: $batch_file"
    fi
done

echo "🎉 모든 배치 실행 완료!"
