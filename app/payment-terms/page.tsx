'use client'

export default function PaymentTermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">결제약관</h1>
        
        <div className="prose prose-gray max-w-none">
          <p className="text-sm text-gray-600 mb-6">시행일: 2025년 1월 1일</p>
          
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제1조 (목적)</h2>
          <p className="text-gray-700 leading-relaxed">
            본 약관은 GenToon이 제공하는 AI 웹툰 제작 서비스의 결제 및 환불에 관한 사항을 정함을 목적으로 합니다.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제2조 (결제 방법)</h2>
          <p className="text-gray-700 leading-relaxed">
            회사는 다음과 같은 결제 방법을 제공합니다:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mt-2">
            <li>토스페이먼츠를 통한 신용카드 결제</li>
            <li>토스페이먼츠를 통한 계좌이체</li>
            <li>기타 회사가 정하는 결제 방법</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제3조 (환불 정책)</h2>
          <p className="text-gray-700 leading-relaxed">
            환불은 다음 기준에 따라 처리됩니다:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mt-2">
            <li>구독 서비스: 결제일로부터 7일 이내 전액 환불 가능</li>
            <li>토큰 구매: 사용하지 않은 토큰에 대해서만 환불 가능</li>
            <li>환불 신청은 고객센터를 통해 접수</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">제4조 (기타사항)</h2>
          <p className="text-gray-700 leading-relaxed">
            본 약관에서 정하지 아니한 사항에 대하여는 관계법령 및 회사의 이용약관에 따릅니다.
          </p>
        </div>
      </div>
    </div>
  );
}