'use client';

import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { InquiryModal } from './inquiry-modal';

export function FloatingContactButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* 플로팅 버튼 */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="group bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
          aria-label="문의하기"
        >
          <MessageCircle className="h-6 w-6" />
          
          {/* 툴팁 */}
          <div className="absolute right-full mr-3 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            문의하기
            <div className="absolute top-1/2 -translate-y-1/2 left-full border-4 border-transparent border-l-gray-900"></div>
          </div>
        </button>
      </div>

      {/* 문의하기 모달 */}
      <InquiryModal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  );
}