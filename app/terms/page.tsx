'use client'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">서비스 이용약관</h1>
        
        <div className="prose prose-gray max-w-none">
          <p className="text-sm text-gray-600 mb-6">시행일: 2025년 1월 1일</p>
          
          <div className="bg-gray-50 p-6 rounded-lg mb-8">
            <h3 className="text-lg font-semibold mb-3">서비스 제공자 정보</h3>
            <ul className="text-sm space-y-1">
              <li><strong>회사명:</strong> 져드코퍼레이션</li>
              <li><strong>대표자:</strong> 김중휘</li>
              <li><strong>서비스명:</strong> GenToon (젠툰)</li>
              <li><strong>고객센터:</strong> contact@gentoon.ai</li>
            </ul>
          </div>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제1조 (목적)</h2>
            <p className="mb-3">
              본 약관은 져드코퍼레이션(이하 "회사")이 제공하는 AI 기반 웹툰 제작 플랫폼 "GenToon" 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제2조 (정의)</h2>
            <p className="mb-3">본 약관에서 사용하는 용어의 정의는 다음과 같습니다:</p>
            <ol className="list-decimal ml-6 space-y-2">
              <li>"서비스"란 회사가 제공하는 AI 기반 웹툰 생성, 캐릭터 관리, 스토리 제작 등 일체의 서비스를 의미합니다.</li>
              <li>"이용자"란 본 약관에 따라 회사가 제공하는 서비스를 받는 회원 및 비회원을 말합니다.</li>
              <li>"회원"이란 회사와 서비스 이용계약을 체결하고 이용자 ID를 부여받은 이용자를 말합니다.</li>
              <li>"토큰"이란 서비스 내에서 AI 기능을 사용하기 위한 디지털 사용권을 의미합니다.</li>
              <li>"콘텐츠"란 이용자가 서비스를 통해 생성한 웹툰, 이미지, 텍스트 등 모든 창작물을 의미합니다.</li>
              <li>"레퍼런스 이미지"란 AI 생성 시 참고용으로 업로드하는 이미지를 의미합니다.</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제3조 (약관의 효력 및 변경)</h2>
            <ol className="list-decimal ml-6 space-y-2">
              <li>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다.</li>
              <li>회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있습니다.</li>
              <li>개정된 약관은 적용일자 및 개정사유를 명시하여 현행약관과 함께 서비스 내 공지사항에 그 적용일자 7일 이전부터 공지합니다.</li>
              <li>회원이 개정약관 적용일 이후에도 서비스를 계속 이용하는 경우 개정약관에 동의한 것으로 간주합니다.</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제4조 (서비스의 제공)</h2>
            <p className="mb-3">회사가 제공하는 서비스는 다음과 같습니다:</p>
            <ol className="list-decimal ml-6 space-y-2">
              <li>AI 기반 웹툰 이미지 생성 서비스</li>
              <li>캐릭터 레퍼런스 저장 및 관리 서비스</li>
              <li>웹툰 프로젝트 관리 및 저장 서비스</li>
              <li>생성된 콘텐츠 다운로드 서비스</li>
              <li>기타 회사가 추가 개발하거나 제휴를 통해 제공하는 서비스</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제5조 (서비스 이용계약의 성립)</h2>
            <ol className="list-decimal ml-6 space-y-2">
              <li>이용계약은 이용자의 이용신청에 대한 회사의 승낙으로 성립됩니다.</li>
              <li>회사는 다음 각 호의 경우 이용신청을 승낙하지 않을 수 있습니다:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>타인의 명의를 도용한 경우</li>
                  <li>허위 정보를 기재한 경우</li>
                  <li>법령 위반 또는 사회 질서를 저해할 목적으로 신청한 경우</li>
                  <li>기타 회사가 정한 이용신청 요건이 미비한 경우</li>
                </ul>
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제6조 (유료서비스의 이용)</h2>
            <ol className="list-decimal ml-6 space-y-2">
              <li>회사는 다음과 같은 유료 구독 플랜을 제공합니다:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>개인 플랜: 월 30,000원 (50만 토큰, 캐릭터 3개 저장)</li>
                  <li>헤비유저 플랜: 월 100,000원 (200만 토큰, 캐릭터 5개 저장)</li>
                  <li>기업 플랜: 월 200,000원 (500만 토큰, 캐릭터 무제한 저장)</li>
                </ul>
              </li>
              <li>토큰은 다음과 같이 소비됩니다:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>이미지 생성: 패널당 2토큰</li>
                  <li>고해상도 출력: 추가 1토큰</li>
                  <li>캐릭터 저장: 1토큰</li>
                </ul>
              </li>
              <li>유료서비스 이용료는 선불제를 원칙으로 하며, 회사가 인정하는 결제수단을 통해 결제할 수 있습니다.</li>
              <li>미사용 토큰은 구독 기간 종료 시 소멸되며, 환불되지 않습니다.</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제7조 (청약철회 및 환불)</h2>
            <ol className="list-decimal ml-6 space-y-2">
              <li>이용자는 구매일로부터 7일 이내에 청약철회를 할 수 있습니다. 단, 디지털 콘텐츠의 특성상 다음의 경우 청약철회가 제한됩니다:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>토큰을 일부라도 사용한 경우</li>
                  <li>AI 생성 서비스를 1회 이상 이용한 경우</li>
                </ul>
              </li>
              <li>회사의 귀책사유로 서비스를 정상적으로 이용할 수 없는 경우, 이용자는 해당 기간만큼의 이용료를 환불받을 수 있습니다.</li>
              <li>환불은 원 결제수단으로 진행되며, 영업일 기준 7일 이내에 처리됩니다.</li>
            </ol>
          </section>

          <section className="mb-8 bg-yellow-50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4 text-red-800">제8조 (지식재산권 및 저작권) ⚠️ 중요</h2>
            <ol className="list-decimal ml-6 space-y-3">
              <li className="font-medium">
                서비스를 통해 생성된 콘텐츠의 저작권은 해당 콘텐츠를 생성한 이용자에게 귀속됩니다.
              </li>
              <li className="font-medium">
                <span className="text-red-700">이용자가 업로드하는 레퍼런스 이미지에 대한 모든 법적 책임은 이용자 본인에게 있습니다.</span> 이용자는 다음을 보증합니다:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>업로드하는 이미지에 대한 적법한 사용 권한을 보유하고 있음</li>
                  <li>타인의 저작권, 초상권, 상표권 등을 침해하지 않음</li>
                  <li>제3자의 권리를 침해하는 레퍼런스로 생성된 콘텐츠의 상업적 이용에 대한 모든 책임을 부담함</li>
                </ul>
              </li>
              <li className="font-medium">
                <span className="text-red-700">회사는 AI 기술을 이용한 이미지 생성 도구만을 제공할 뿐, 이용자가 생성한 콘텐츠의 저작권 침해 여부를 판단하거나 보증하지 않습니다.</span>
              </li>
              <li>
                이용자가 제3자의 저작권을 침해하여 발생하는 모든 민·형사상 책임은 이용자가 부담하며, 이로 인해 회사가 손해를 입은 경우 이용자는 회사에 배상할 책임이 있습니다.
              </li>
              <li>
                회사는 이용자가 서비스를 통해 생성한 콘텐츠를 서비스 홍보, 마케팅, 품질 개선 목적으로 사용할 수 있으며, 이 경우 이용자의 개인정보는 노출되지 않습니다.
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제9조 (이용자의 의무)</h2>
            <p className="mb-3">이용자는 다음 행위를 하여서는 안 됩니다:</p>
            <ol className="list-decimal ml-6 space-y-2">
              <li>타인의 정보 도용 및 허위정보 입력</li>
              <li>회사가 게시한 정보의 무단 변경</li>
              <li>회사와 기타 제3자의 저작권 등 지식재산권 침해</li>
              <li>음란물, 폭력적 콘텐츠 등 공공질서 및 미풍양속에 위반되는 콘텐츠 생성</li>
              <li>아동·청소년을 성적 대상으로 하는 콘텐츠 생성</li>
              <li>타인의 명예를 손상시키거나 불이익을 주는 행위</li>
              <li>서비스의 안정적 운영을 방해하는 행위</li>
              <li>기타 불법적이거나 부당한 행위</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제10조 (서비스 이용 제한)</h2>
            <ol className="list-decimal ml-6 space-y-2">
              <li>회사는 이용자가 본 약관의 의무를 위반하거나 서비스의 정상적인 운영을 방해한 경우, 경고, 일시정지, 영구이용정지 등의 조치를 취할 수 있습니다.</li>
              <li>회사는 다음의 경우 사전통지 없이 이용계약을 해지할 수 있습니다:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>타인의 서비스 ID 및 비밀번호를 도용한 경우</li>
                  <li>서비스 운영을 고의로 방해한 경우</li>
                  <li>불법 콘텐츠를 생성하거나 유포한 경우</li>
                  <li>타인의 저작권을 반복적으로 침해한 경우</li>
                </ul>
              </li>
            </ol>
          </section>

          <section className="mb-8 bg-blue-50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">제11조 (면책조항)</h2>
            <ol className="list-decimal ml-6 space-y-3">
              <li className="font-medium">
                회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력으로 인하여 서비스를 제공할 수 없는 경우 책임이 면제됩니다.
              </li>
              <li className="font-medium">
                회사는 이용자의 귀책사유로 인한 서비스 이용의 장애에 대하여 책임을 지지 않습니다.
              </li>
              <li className="font-medium text-blue-900">
                회사는 이용자가 서비스를 이용하여 생성한 콘텐츠의 적법성, 신뢰성, 정확성 등을 보증하지 않습니다.
              </li>
              <li className="font-medium text-blue-900">
                회사는 이용자가 업로드한 레퍼런스 이미지나 생성된 콘텐츠가 제3자의 권리를 침해함으로써 발생하는 손해에 대해 책임을 지지 않습니다.
              </li>
              <li>
                회사는 이용자 상호간 또는 이용자와 제3자 간에 서비스를 매개로 발생한 분쟁에 대해 개입할 의무가 없으며, 이로 인한 손해를 배상할 책임이 없습니다.
              </li>
              <li className="font-medium">
                AI 기술의 특성상 생성된 이미지가 기대와 다를 수 있으며, 이는 환불 사유가 되지 않습니다.
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제12조 (손해배상)</h2>
            <ol className="list-decimal ml-6 space-y-2">
              <li>회사가 고의 또는 중과실로 이용자에게 손해를 입힌 경우, 회사는 이용자에게 발생한 손해를 배상합니다.</li>
              <li>이용자가 본 약관을 위반하여 회사에 손해를 입힌 경우, 이용자는 회사에 발생한 모든 손해를 배상해야 합니다.</li>
              <li>이용자가 서비스를 이용함에 있어 행한 불법행위나 본 약관 위반행위로 인하여 회사가 제3자로부터 손해배상 청구 또는 소송을 비롯한 각종 이의제기를 받는 경우, 이용자는 자신의 책임과 비용으로 회사를 면책시켜야 합니다.</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제13조 (분쟁해결)</h2>
            <ol className="list-decimal ml-6 space-y-2">
              <li>회사와 이용자 간에 발생한 분쟁은 상호 협의하여 해결하는 것을 원칙으로 합니다.</li>
              <li>협의가 이루어지지 않는 경우, 「콘텐츠산업진흥법」에 따른 콘텐츠분쟁조정위원회의 조정을 받을 수 있습니다.</li>
              <li>회사와 이용자 간 발생한 분쟁에 관한 소송은 민사소송법상의 관할법원에 제기합니다.</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">제14조 (준거법)</h2>
            <p>
              본 약관의 해석 및 회사와 이용자 간의 분쟁에 대하여는 대한민국의 법률을 적용합니다.
            </p>
          </section>

          <section className="mb-8 bg-gray-100 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">부칙</h2>
            <ol className="list-decimal ml-6 space-y-2">
              <li>본 약관은 2025년 1월 1일부터 시행됩니다.</li>
              <li>이전 약관은 본 약관으로 대체되며, 본 약관 시행 이전에 가입한 회원에게도 적용됩니다.</li>
            </ol>
          </section>

          <div className="mt-12 p-6 bg-red-50 rounded-lg border-2 border-red-200">
            <h3 className="text-lg font-bold text-red-800 mb-3">⚠️ 저작권 관련 중요 고지</h3>
            <p className="text-sm text-red-700 leading-relaxed">
              본 서비스는 AI 기술을 활용한 창작 도구를 제공하는 플랫폼입니다. 
              <strong>이용자가 업로드하는 모든 레퍼런스 이미지와 생성된 콘텐츠의 저작권 관련 책임은 전적으로 이용자 본인에게 있습니다.</strong> 
              타인의 저작물을 무단으로 사용하여 발생하는 법적 분쟁에 대해 회사는 어떠한 책임도 지지 않으며, 
              이용자는 생성된 콘텐츠를 상업적으로 이용하기 전 반드시 저작권 침해 여부를 확인해야 합니다.
            </p>
          </div>

          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">문의사항</h3>
            <p className="text-sm text-gray-600">
              본 약관에 대한 문의사항이나 서비스 관련 문의는 아래로 연락주시기 바랍니다.
            </p>
            <p className="text-sm font-medium mt-2">
              <strong>이메일:</strong> contact@gentoon.ai<br/>
              <strong>회사명:</strong> 져드코퍼레이션<br/>
              <strong>대표자:</strong> 김중휘
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}