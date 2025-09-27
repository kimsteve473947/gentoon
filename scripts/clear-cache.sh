#!/bin/bash
echo "🧹 Next.js 캐시 정리 중..."

# .next 캐시만 삭제 (서버는 유지)
rm -rf .next/cache
rm -rf .next/static
rm -rf .next/server/static

echo "✅ 캐시 정리 완료! 브라우저를 새로고침하세요."