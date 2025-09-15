'use client'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">개인정보처리방침</h1>
        
        <div className="prose prose-gray max-w-none">
          <p className="text-sm text-gray-600 mb-6">시행일: 2025년 1월 1일</p>
          
          <div className="bg-gray-50 p-6 rounded-lg mb-8">
            <h3 className="text-lg font-semibold mb-3">개인정보보호책임자 정보</h3>
            <ul className="text-sm space-y-1">
              <li><strong>회사명:</strong> 져드코퍼레이션</li>
              <li><strong>대표자:</strong> 김중휘</li>
              <li><strong>개인정보보호책임자:</strong> 김중휘</li>
              <li><strong>서비스명:</strong> GenToon (젠툰)</li>
              <li><strong>연락처:</strong> contact@gentoon.ai</li>
            </ul>
          </div>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제1조 (총칙)</h2>
            <p className="mb-3">
              져드코퍼레이션(이하 "회사")은 이용자의 개인정보를 중요시하며, 「개인정보보호법」, 「정보통신망 이용촉진 및 정보보호에 관한 법률」 등 관련 법령을 준수하고 있습니다.
            </p>
            <p className="mb-3">
              본 개인정보처리방침은 회사가 제공하는 AI 기반 웹툰 제작 플랫폼 "GenToon" 서비스(이하 "서비스")에 적용되며, 다음과 같은 목적으로 개인정보를 처리합니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제2조 (수집하는 개인정보 항목 및 수집방법)</h2>
            
            <h3 className="text-lg font-medium mb-2">1. 수집항목</h3>
            <div className="ml-4 mb-4">
              <h4 className="font-medium mb-2">필수항목:</h4>
              <ul className="list-disc ml-6 space-y-1">
                <li>회원가입: 이메일, 비밀번호, 닉네임</li>
                <li>결제정보: 결제수단 정보(카드번호 일부, 은행명), 결제 기록</li>
                <li>서비스 이용기록: 접속 IP, 접속 시간, 서비스 이용 기록</li>
                <li>생성 콘텐츠: 업로드한 이미지, 생성한 웹툰, 프롬프트 내용</li>
              </ul>
            </div>
            
            <div className="ml-4 mb-4">
              <h4 className="font-medium mb-2">선택항목:</h4>
              <ul className="list-disc ml-6 space-y-1">
                <li>프로필 정보: 프로필 이미지, 자기소개</li>
                <li>추천인 코드</li>
              </ul>
            </div>

            <h3 className="text-lg font-medium mb-2">2. 수집방법</h3>
            <ul className="list-disc ml-6 space-y-1">
              <li>회원가입 및 서비스 이용 과정에서 이용자가 직접 입력</li>
              <li>서비스 이용 과정에서 자동으로 생성되어 수집</li>
              <li>제휴사(Supabase Auth, Toss Payments)로부터 제공받음</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제3조 (개인정보의 처리 목적)</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>회원 관리: 회원제 서비스 제공, 본인확인, 불법 이용 방지</li>
              <li>서비스 제공: AI 웹툰 생성, 캐릭터 관리, 저장 및 불러오기</li>
              <li>결제 및 정산: 유료 서비스 이용에 따른 요금 결제 및 정산</li>
              <li>마케팅: 신규 서비스 안내, 이벤트 정보 제공 (동의자에 한함)</li>
              <li>서비스 개선: 서비스 이용 통계 분석, 서비스 품질 향상</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제4조 (개인정보의 보유 및 이용기간)</h2>
            <div className="mb-4">
              <p className="mb-3">회사는 법령에 따른 개인정보 보유·이용기간 또는 이용자로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.</p>
              
              <h3 className="text-lg font-medium mb-2">1. 회원정보</h3>
              <ul className="list-disc ml-6 space-y-1">
                <li>보유기간: 회원 탈퇴 시까지</li>
                <li>단, 관계법령 위반에 따른 수사·조사 진행 중인 경우 해당 수사·조사 종료 시까지</li>
              </ul>

              <h3 className="text-lg font-medium mb-2 mt-4">2. 법령에 따른 보유</h3>
              <ul className="list-disc ml-6 space-y-1">
                <li>전자상거래법: 계약 또는 청약철회 기록 (5년)</li>
                <li>전자상거래법: 대금결제 및 재화 공급 기록 (5년)</li>
                <li>전자상거래법: 소비자 불만 또는 분쟁처리 기록 (3년)</li>
                <li>통신비밀보호법: 서비스 이용 기록, 접속 로그 (3개월)</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제5조 (개인정보의 제3자 제공)</h2>
            <p className="mb-3">
              회사는 원칙적으로 이용자의 개인정보를 제1조에서 명시한 목적 범위 내에서 처리하며, 이용자의 사전 동의 없이 제3자에게 제공하지 않습니다. 다만, 다음의 경우는 예외로 합니다.
            </p>
            <ul className="list-disc ml-6 space-y-1">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제6조 (개인정보처리의 위탁)</h2>
            <p className="mb-3">회사는 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다:</p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300 mt-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2">수탁업체</th>
                    <th className="border border-gray-300 px-4 py-2">위탁업무</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">Supabase Inc.</td>
                    <td className="border border-gray-300 px-4 py-2">회원 인증, 데이터베이스 관리, 파일 저장</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">토스페이먼츠</td>
                    <td className="border border-gray-300 px-4 py-2">결제 처리 및 정산</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">Vercel Inc.</td>
                    <td className="border border-gray-300 px-4 py-2">서비스 호스팅 및 CDN</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">Google LLC</td>
                    <td className="border border-gray-300 px-4 py-2">AI 모델(Gemini 2.5 Flash) 제공</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제7조 (이용자의 권리와 의무)</h2>
            <p className="mb-3">이용자는 다음의 권리를 행사할 수 있습니다:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>개인정보 열람 요구</li>
              <li>오류 정정 요구</li>
              <li>삭제 요구</li>
              <li>처리정지 요구</li>
            </ul>
            <p className="mt-3">
              권리 행사는 서비스 내 설정 메뉴 또는 고객센터를 통해 가능하며, 법정 대리인이나 위임받은 자를 통해서도 가능합니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제8조 (개인정보의 파기)</h2>
            <p className="mb-3">
              회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.
            </p>
            <div className="ml-4">
              <h3 className="text-lg font-medium mb-2">파기절차:</h3>
              <ul className="list-disc ml-6 space-y-1">
                <li>이용자가 입력한 정보는 목적 달성 후 별도의 DB에 옮겨져 내부 방침에 따라 일정기간 저장된 후 파기</li>
                <li>법령에 따라 보존이 필요한 경우 해당 법령에서 정한 기간 동안 보관</li>
              </ul>
              
              <h3 className="text-lg font-medium mb-2 mt-4">파기방법:</h3>
              <ul className="list-disc ml-6 space-y-1">
                <li>전자적 파일: 복구 불가능한 방법으로 영구 삭제</li>
                <li>종이 문서: 분쇄기로 분쇄하거나 소각</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제9조 (개인정보의 안전성 확보조치)</h2>
            <p className="mb-3">회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다:</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>관리적 조치: 내부관리계획 수립·시행, 정기적 직원 교육</li>
              <li>기술적 조치: 개인정보처리시스템 접근권한 관리, 고유식별정보 암호화, 보안프로그램 설치</li>
              <li>물리적 조치: 전산실, 자료보관실 등의 접근통제</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제10조 (쿠키의 사용)</h2>
            <p className="mb-3">
              회사는 이용자에게 개별적인 맞춤서비스를 제공하기 위해 쿠키를 사용합니다.
            </p>
            <div className="ml-4">
              <h3 className="text-lg font-medium mb-2">1. 쿠키의 사용 목적</h3>
              <ul className="list-disc ml-6 space-y-1">
                <li>회원 로그인 유지</li>
                <li>이용자 선호 설정 저장</li>
                <li>서비스 이용 통계 분석</li>
              </ul>
              
              <h3 className="text-lg font-medium mb-2 mt-4">2. 쿠키 거부 방법</h3>
              <p>브라우저 설정을 통해 쿠키를 거부할 수 있으나, 일부 서비스 이용에 제한이 있을 수 있습니다.</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제11조 (개인정보보호책임자)</h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-medium mb-2">개인정보보호책임자</p>
              <ul className="space-y-1 text-sm">
                <li>성명: 김중휘</li>
                <li>직책: 대표이사</li>
                <li>이메일: contact@gentoon.ai</li>
                <li>회사명: 져드코퍼레이션</li>
              </ul>
            </div>
            <p className="mt-3">
              기타 개인정보침해에 대한 신고나 상담이 필요하신 경우에는 아래 기관에 문의하시기 바랍니다:
            </p>
            <ul className="list-disc ml-6 space-y-1 mt-2">
              <li>개인정보침해신고센터 (privacy.kisa.or.kr / 118)</li>
              <li>개인정보보호위원회 (www.pipc.go.kr / 1833-6972)</li>
              <li>대검찰청 사이버수사과 (www.spo.go.kr / 1301)</li>
              <li>경찰청 사이버수사국 (ecrm.police.go.kr / 182)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제12조 (개인정보처리방침의 변경)</h2>
            <p>
              이 개인정보처리방침은 2025년 1월 1일부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
            </p>
          </section>

          <div className="mt-8 p-4 bg-green-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">개인정보 관련 문의</h3>
            <p className="text-sm text-gray-600 mb-2">
              개인정보처리방침에 대한 문의사항이나 개인정보 관련 신고, 상담이 필요하신 경우 아래 연락처로 문의해 주시기 바랍니다.
            </p>
            <div className="text-sm font-medium">
              <p><strong>이메일:</strong> contact@gentoon.ai</p>
              <p><strong>회사명:</strong> 져드코퍼레이션</p>
              <p><strong>개인정보보호책임자:</strong> 김중휘 (대표이사)</p>
              <p><strong>처리기한:</strong> 접수 후 7일 이내 답변</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}