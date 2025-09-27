import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-100 border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-bold mb-4">GenToon</h3>
            <p className="text-sm text-gray-600">
              AI 기반 웹툰 제작 플랫폼
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3">서비스</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/studio" className="text-gray-600 hover:text-gray-900">
                  웹툰 스튜디오
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                  대시보드
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-gray-600 hover:text-gray-900">
                  요금제
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3">법적 고지</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/terms" className="text-gray-600 hover:text-gray-900">
                  이용약관
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-600 hover:text-gray-900">
                  개인정보처리방침
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3">고객지원</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>회사명: 져드코퍼레이션</li>
              <li>대표자: 김중휘</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-600">
              © 2025 져드코퍼레이션. All rights reserved.
            </p>
            <div className="mt-4 md:mt-0 text-xs text-gray-500 max-w-2xl text-center md:text-right">
              <p className="font-semibold mb-1">⚠️ 저작권 고지</p>
              <p>
                본 서비스는 AI 창작 도구를 제공합니다. 레퍼런스 이미지 사용 및 생성된 콘텐츠의 저작권 관련 모든 책임은 이용자에게 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}