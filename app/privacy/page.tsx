'use client'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">개인정보처리방침</h1>
        
        <div className="prose prose-gray max-w-none">
          <p className="text-sm text-gray-600 mb-6">시행일: 2025년 1월 1일</p>
          
          <div className="bg-gray-50 p-6 rounded-lg mb-8">
            <h3 className="text-lg font-semibold mb-3">개인정보처리방침 요약</h3>
            <ul className="text-sm space-y-2">
              <li>• <strong>수집목적:</strong> GenToon 서비스 제공, 회원 관리, 결제 처리</li>
              <li>• <strong>수집항목:</strong> 이메일, 이름, 결제정보, 서비스 이용 기록</li>
              <li>• <strong>보유기간:</strong> 회원탈퇴 시까지 (법정 보존기간 적용)</li>
              <li>• <strong>제3자 제공:</strong> 결제대행사(토스페이먼츠), Google(인증), Vercel(호스팅)</li>
            </ul>
          </div>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. 개인정보의 처리목적</h2>
            <p className="mb-3">
              져드코퍼레이션(이하 '회사')은 다음의 목적을 위하여 개인정보를 처리합니다. 
              처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 
              이용 목적이 변경되는 경우에는 정보통신망 이용촉진 및 정보보호 등에 관한 법률 
              제22조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
            </p>
            <ol className="list-decimal ml-6 space-y-2">
              <li>회원 가입 및 관리: 회원 식별, 서비스 이용에 따른 본인확인</li>
              <li>재화 또는 서비스 제공: AI 웹툰 생성 서비스 제공, 결제 및 정산</li>
              <li>마케팅 및 광고: 이벤트 및 광고성 정보 제공, 서비스 개선을 위한 분석</li>
              <li>고충처리: 민원인의 신원 확인, 민원사항 확인, 사실조사</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. 개인정보의 처리 및 보유기간</h2>
            <ol className="list-decimal ml-6 space-y-3">
              <li>
                <strong>회원정보</strong>
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>처리목적: 회원 관리 및 서비스 제공</li>
                  <li>보유기간: 회원탈퇴 시까지</li>
                  <li>근거: 이용자 동의</li>
                </ul>
              </li>
              <li>
                <strong>결제정보</strong>
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>처리목적: 서비스 이용료 결제 및 환불</li>
                  <li>보유기간: 5년</li>
                  <li>근거: 전자상거래등에서의 소비자보호에 관한 법률</li>
                </ul>
              </li>
              <li>
                <strong>서비스 이용기록</strong>
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>처리목적: 서비스 개선 및 부정 이용 방지</li>
                  <li>보유기간: 3개월</li>
                  <li>근거: 통신비밀보호법</li>
                </ul>
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. 개인정보의 수집항목 및 방법</h2>
            <h3 className="text-lg font-medium mb-3">가. 수집항목</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-200 px-4 py-2 text-left">구분</th>
                    <th className="border border-gray-200 px-4 py-2 text-left">필수항목</th>
                    <th className="border border-gray-200 px-4 py-2 text-left">선택항목</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-4 py-2 font-medium">회원가입</td>
                    <td className="border border-gray-200 px-4 py-2">이메일, 비밀번호, 이름</td>
                    <td className="border border-gray-200 px-4 py-2">프로필 이미지</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-4 py-2 font-medium">결제</td>
                    <td className="border border-gray-200 px-4 py-2">카드번호, 유효기간, 생년월일/사업자번호</td>
                    <td className="border border-gray-200 px-4 py-2">-</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-4 py-2 font-medium">서비스 이용</td>
                    <td className="border border-gray-200 px-4 py-2">IP주소, 접속로그, 이용기록</td>
                    <td className="border border-gray-200 px-4 py-2">생성된 콘텐츠, 레퍼런스 이미지</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-medium mb-3 mt-6">나. 수집방법</h3>
            <ul className="list-disc ml-6 space-y-1">
              <li>홈페이지, 모바일 앱을 통한 회원가입 및 서비스 이용</li>
              <li>Google OAuth를 통한 소셜 로그인</li>
              <li>결제대행사(토스페이먼츠)를 통한 결제 정보 수집</li>
              <li>고객센터를 통한 상담 과정에서 수집</li>
            </ul>
          </section>

          <section className="mb-8 bg-blue-50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">4. 개인정보의 제3자 제공</h2>
            <p className="mb-4">회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 
            다만, 아래의 경우에는 예외로 합니다:</p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 text-sm bg-white rounded">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-200 px-3 py-2 text-left">제공받는 자</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">제공목적</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">제공항목</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">보유기간</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">토스페이먼츠</td>
                    <td className="border border-gray-200 px-3 py-2">결제처리</td>
                    <td className="border border-gray-200 px-3 py-2">결제정보, 구매정보</td>
                    <td className="border border-gray-200 px-3 py-2">거래 완료 후 5년</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">Google LLC</td>
                    <td className="border border-gray-200 px-3 py-2">소셜 로그인, AI 서비스</td>
                    <td className="border border-gray-200 px-3 py-2">이메일, 프로필 정보</td>
                    <td className="border border-gray-200 px-3 py-2">서비스 이용 종료시까지</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">Vercel Inc.</td>
                    <td className="border border-gray-200 px-3 py-2">서비스 호스팅</td>
                    <td className="border border-gray-200 px-3 py-2">서비스 이용 로그</td>
                    <td className="border border-gray-200 px-3 py-2">3개월</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. 개인정보처리의 위탁</h2>
            <p className="mb-4">회사는 서비스 품질 향상을 위해 개인정보 처리업무를 위탁하고 있으며, 
            위탁계약 시 개인정보보호법에 따라 위탁업무 수행목적 외 개인정보 처리금지, 
            기술적·관리적 보호조치, 재위탁 제한, 수탁자에 대한 관리·감독, 
            손해배상 등 책임에 관한 사항을 계약서 등 문서에 명시하고 있습니다.</p>
            
            <div className="bg-white border border-gray-200 rounded p-4">
              <h4 className="font-medium mb-2">위탁업체 현황</h4>
              <ul className="text-sm space-y-2">
                <li>• <strong>Supabase Inc.:</strong> 데이터베이스 관리 및 사용자 인증</li>
                <li>• <strong>Vercel Inc.:</strong> 웹사이트 호스팅 및 CDN 서비스</li>
                <li>• <strong>Google Cloud Platform:</strong> AI 이미지 생성 서비스</li>
                <li>• <strong>토스페이먼츠(주):</strong> 결제 처리 및 정산</li>
              </ul>
            </div>
          </section>

          <section className="mb-8 bg-yellow-50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4 text-yellow-800">6. 이용자의 권리와 행사방법 ⚠️</h2>
            <p className="mb-4">정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보보호 관련 권리를 행사할 수 있습니다:</p>
            <ol className="list-decimal ml-6 space-y-2">
              <li><strong>개인정보 처리현황 통지요구</strong></li>
              <li><strong>개인정보 열람요구</strong></li>
              <li><strong>개인정보 정정·삭제요구</strong></li>
              <li><strong>개인정보 처리정지 요구</strong></li>
            </ol>
            <div className="mt-4 p-3 bg-yellow-100 rounded border-l-4 border-yellow-400">
              <p className="text-sm text-yellow-800">
                <strong>권리행사 방법:</strong> 설정 &gt; 내 계정에서 직접 수정하거나, 
                고객센터(contact@gentoon.ai)로 요청하실 수 있습니다.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. 개인정보의 안전성 확보조치</h2>
            <p className="mb-3">회사는 개인정보보호법 제29조에 따라 다음과 같이 안전성 확보에 필요한 기술적·관리적 조치를 하고 있습니다:</p>
            <ol className="list-decimal ml-6 space-y-2">
              <li><strong>관리적 조치:</strong> 내부관리계획 수립·시행, 전담조직 운영, 정기적 직원 교육</li>
              <li><strong>기술적 조치:</strong> 개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 고유식별정보 등의 암호화, 보안프로그램 설치 및 갱신</li>
              <li><strong>물리적 조치:</strong> 전산실, 자료보관실 등의 접근통제</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. 쿠키(Cookie)의 운영 및 거부</h2>
            <ol className="list-decimal ml-6 space-y-3">
              <li>
                <strong>쿠키의 사용 목적</strong>
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>로그인 상태 유지</li>
                  <li>사용자 맞춤형 서비스 제공</li>
                  <li>웹사이트 이용 통계 분석</li>
                </ul>
              </li>
              <li>
                <strong>쿠키 설정 거부 방법</strong>
                <p className="mt-2 text-sm">
                  웹브라우저 설정에서 쿠키를 거부할 수 있습니다. 
                  다만, 쿠키를 거부할 경우 일부 서비스 이용에 제한이 있을 수 있습니다.
                </p>
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. 개인정보보호책임자</h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="mb-3">회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보보호책임자를 지정하고 있습니다.</p>
              <div className="text-sm">
                <p><strong>개인정보보호책임자</strong></p>
                <ul className="mt-2 space-y-1">
                  <li>• 성명: 김중휘</li>
                  <li>• 직책: 대표이사</li>
                  <li>• 연락처: contact@gentoon.ai</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">10. 개인정보 침해신고센터</h2>
            <p className="mb-3">개인정보보호법 제35조에 따른 개인정보의 열람 청구를 하려면서 다음 각 호의 사항을 적어서 개인정보보호책임자에게 제출하여야 합니다.</p>
            <div className="bg-blue-50 p-4 rounded-lg">
              <ul className="text-sm space-y-1">
                <li>• <strong>개인정보보호위원회:</strong> privacy.go.kr / 국번없이 182</li>
                <li>• <strong>개인정보침해신고센터:</strong> privacy.kisa.or.kr / 국번없이 118</li>
                <li>• <strong>대검찰청 사이버수사과:</strong> spo.go.kr / (02) 3480-2000</li>
                <li>• <strong>경찰청 사이버안전국:</strong> cyberbureau.police.go.kr / (02) 392-0330</li>
              </ul>
            </div>
          </section>

          <section className="mb-8 bg-gray-100 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">11. 개인정보처리방침의 변경</h2>
            <ol className="list-decimal ml-6 space-y-2">
              <li>이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.</li>
              <li>본 방침은 2025년 1월 1일부터 시행됩니다.</li>
            </ol>
          </section>

          <div className="mt-12 p-6 bg-green-50 rounded-lg border-2 border-green-200">
            <h3 className="text-lg font-bold text-green-800 mb-3">📞 개인정보 관련 문의</h3>
            <p className="text-sm text-green-700 leading-relaxed mb-3">
              개인정보 처리에 대한 문의사항이나 권리 행사를 원하시는 경우 아래로 연락주시기 바랍니다.
            </p>
            <div className="text-sm">
              <p><strong>이메일:</strong> contact@gentoon.ai</p>
              <p><strong>회사명:</strong> 져드코퍼레이션</p>
              <p><strong>대표자:</strong> 김중휘</p>
              <p><strong>개인정보보호책임자:</strong> 김중휘</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}