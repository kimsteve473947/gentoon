'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft,
  CreditCard,
  Plus,
  Shield,
  AlertCircle,
  CheckCircle,
  Copy,
  Mail,
  Building
} from 'lucide-react';
import Link from 'next/link';

interface PaymentMethod {
  id: string;
  company: string;
  number: string;
  type: string;
  isDefault: boolean;
  registeredAt: string;
}

export default function PaymentMethodPage() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [processing, setProcessing] = useState(false);

  // 새 결제수단 추가 폼 데이터
  const [formData, setFormData] = useState({
    company: '',
    number: '',
    email: ''
  });

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      
      // 현재 구독 정보에서 등록된 카드 정보 가져오기
      const response = await fetch('/api/settings?details=true');
      const data = await response.json();

      if (data.success && data.data.subscription?.cardInfo) {
        const cardInfo = data.data.subscription.cardInfo;
        setPaymentMethods([{
          id: 'current',
          company: cardInfo.company || '등록된 카드',
          number: cardInfo.number || '',
          type: cardInfo.type || 'CREDIT',
          isDefault: true,
          registeredAt: data.data.subscription.createdAt || new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    if (!formData.company || !formData.number || !formData.email) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    try {
      setProcessing(true);

      // 토스페이먼츠 빌링키 등록 프로세스
      alert('새로운 결제수단 등록을 위해 고객지원팀에 문의가 접수됩니다.\n담당자가 안전한 카드 등록 과정을 도와드리겠습니다.');
      
      // 실제로는 고객지원 시스템으로 전송하거나 별도 프로세스 필요
      setShowAddForm(false);
      setFormData({ company: '', number: '', email: '' });
      
    } catch (error) {
      console.error('Error adding payment method:', error);
      alert('결제수단 추가 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeletePaymentMethod = async (methodId: string) => {
    if (!confirm('결제수단을 삭제하시겠습니까? 구독이 해지될 수 있습니다.')) {
      return;
    }

    try {
      alert('결제수단 삭제는 고객지원을 통해 처리됩니다. 담당자에게 문의해주세요.');
    } catch (error) {
      console.error('Error deleting payment method:', error);
    }
  };

  const formatCardNumber = (number: string) => {
    if (!number) return '';
    return `**** **** **** ${number.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-6 py-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-64"></div>
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <div className="h-6 bg-gray-200 rounded w-32"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/settings/subscription">
              <Button variant="outline" size="sm" className="text-gray-600">
                <ArrowLeft className="h-4 w-4 mr-2" />
                돌아가기
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">결제수단 관리</h1>
              <p className="text-gray-600 mt-1">등록된 결제수단을 관리하고 새 카드를 추가하세요</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-4xl mx-auto space-y-6">
        {/* 보안 안내 */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900">안전한 결제수단 관리</h3>
                <p className="text-sm text-blue-700 mt-1">
                  모든 결제 정보는 토스페이먼츠의 보안 시스템을 통해 암호화되어 저장됩니다.
                  카드 정보는 당사 서버에 저장되지 않습니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 등록된 결제수단 */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                등록된 결제수단
              </CardTitle>
              <Button 
                onClick={() => setShowAddForm(true)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                새 결제수단 추가
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentMethods.length > 0 ? (
              paymentMethods.map((method) => (
                <div key={method.id} className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <CreditCard className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{method.company}</h3>
                          {method.isDefault && (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full border border-green-200">
                              기본 결제수단
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{formatCardNumber(method.number)}</p>
                        <p className="text-xs text-gray-500">
                          등록일: {new Date(method.registeredAt).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!method.isDefault && (
                        <Button variant="outline" size="sm">
                          기본 설정
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeletePaymentMethod(method.id)}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">등록된 결제수단이 없습니다</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 새 결제수단 추가 폼 */}
        {showAddForm && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>새 결제수단 추가</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 쿠폰/이용권 */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">쿠폰/이용권</Label>
                <p className="text-sm text-gray-600">쿠폰 또는 이용권을 쿠폰함에 등록하고 사용하세요.</p>
                
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <Button variant="outline" className="w-full justify-center">
                    쿠폰함 열기
                    <svg className="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="6,9 12,15 18,9"></polyline>
                    </svg>
                  </Button>
                </div>
              </div>

              {/* 업체 정보 */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">업체 정보</Label>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="company" className="text-sm text-gray-600">
                      업체명 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="company"
                      placeholder="업체명을 입력해주세요"
                      value={formData.company}
                      onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="number" className="text-sm text-gray-600">
                      업체 주소 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="number"
                      placeholder="업체 주소를 입력해주세요"
                      value={formData.number}
                      onChange={(e) => setFormData(prev => ({ ...prev, number: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>

                <Button variant="outline" className="w-full justify-center">
                  변경사항 저장
                </Button>
              </div>

              {/* 결제 정보 수신 이메일 */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">결제 정보 수신 이메일</Label>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="email"
                      placeholder="example@mail.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="flex-1"
                    />
                    <Button variant="outline" size="sm">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="text-purple-600 p-0 h-auto">
                    + 수신 이메일 추가
                  </Button>
                </div>

                <Button variant="outline" className="w-full justify-center">
                  변경사항 저장
                </Button>
              </div>

              {/* 폼 액션 버튼 */}
              <div className="flex gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowAddForm(false)}
                >
                  취소
                </Button>
                <Button 
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  onClick={handleAddPaymentMethod}
                  disabled={processing}
                >
                  {processing ? '처리 중...' : '저장'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 안내사항 */}
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-medium text-orange-900">결제수단 변경 안내</h3>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• 토스페이먼츠 보안정책에 따라 결제수단 변경은 새로운 등록 과정이 필요합니다</li>
                  <li>• 기존 결제수단 삭제 시 구독이 일시 중단될 수 있습니다</li>
                  <li>• 새 결제수단 등록 완료 후 기존 수단을 안전하게 삭제할 수 있습니다</li>
                  <li>• 결제 관련 문의사항은 고객지원팀으로 연락해주세요</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 고객지원 연락처 */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              고객지원
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-blue-900">이메일 문의</h3>
                    <p className="text-sm text-blue-700">support@gentoon.ai</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Building className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-green-900">고객센터</h3>
                    <p className="text-sm text-green-700">평일 9:00 - 18:00</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}