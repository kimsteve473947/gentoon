/**
 * 🏗️ 배경 디스크립터 엔진
 * 
 * 이미지 전송 없이 텍스트만으로 완벽한 배경 연속성 구현
 * Gemini가 정확히 같은 배경을 그릴 수 있도록 극도로 구체적인 설명 생성
 */

export interface BackgroundDescriptor {
  // 핵심 식별 요소들
  primaryType: string;           // "모던 카페", "아늑한 레스토랑"
  specificDetails: string[];     // 구체적인 디테일들
  colorScheme: string;           // 색상 체계
  lighting: string;              // 조명 설정
  furnitureLayout: string;       // 가구 배치
  wallsAndDecor: string;         // 벽과 장식
  flooring: string;              // 바닥재
  uniqueFeatures: string[];      // 고유한 특징들
  atmosphereDetails: string;     // 분위기 디테일
}

export class BackgroundDescriptorEngine {
  
  /**
   * 🎨 사용자 프롬프트에서 배경 디스크립터 생성
   */
  static generateBackgroundDescriptor(userPrompt: string): BackgroundDescriptor {
    const prompt = userPrompt.toLowerCase();
    
    // 장소 타입 감지
    const primaryType = this.detectPrimaryType(prompt);
    
    // 배경 타입별 상세 디스크립터 생성
    return this.createDetailedDescriptor(primaryType, prompt);
  }
  
  /**
   * 🔍 장소 타입 감지
   */
  private static detectPrimaryType(prompt: string): string {
    const typeMap = {
      // 음식점/카페류
      '카페': 'modern_cafe',
      '커피숍': 'coffee_shop', 
      '레스토랑': 'restaurant',
      '음식점': 'dining_place',
      '식당': 'restaurant',
      
      // 교육시설
      '교실': 'classroom',
      '학교': 'school',
      '도서관': 'library',
      
      // 주거공간
      '집': 'home_interior',
      '방': 'bedroom',
      '거실': 'living_room',
      '부엌': 'kitchen',
      
      // 상업시설
      '상점': 'shop',
      '백화점': 'department_store',
      '마트': 'supermarket',
      
      // 기타
      '사무실': 'office',
      '병원': 'hospital',
      '공원': 'park'
    };
    
    for (const [keyword, type] of Object.entries(typeMap)) {
      if (prompt.includes(keyword)) {
        return type;
      }
    }
    
    return 'generic_interior';
  }
  
  /**
   * 🏗️ 상세 디스크립터 생성
   */
  private static createDetailedDescriptor(
    primaryType: string, 
    userPrompt: string
  ): BackgroundDescriptor {
    
    switch (primaryType) {
      case 'modern_cafe':
      case 'coffee_shop':
        return this.createCafeDescriptor(userPrompt);
        
      case 'restaurant':
      case 'dining_place':
        return this.createRestaurantDescriptor(userPrompt);
        
      case 'classroom':
        return this.createClassroomDescriptor(userPrompt);
        
      case 'living_room':
        return this.createLivingRoomDescriptor(userPrompt);
        
      default:
        return this.createGenericInteriorDescriptor(userPrompt);
    }
  }
  
  /**
   * ☕ 카페 디스크립터 생성
   */
  private static createCafeDescriptor(userPrompt: string): BackgroundDescriptor {
    return {
      primaryType: "모던하고 아늑한 카페 내부",
      specificDetails: [
        "원목 테이블과 검은색 철제 의자 조합",
        "벽면을 따라 배치된 높은 테이블과 바 스툴",
        "카운터 뒤편의 에스프레소 머신과 원두 진열대",
        "천장에 매달린 따뜻한 펜던트 조명",
        "큰 창문을 통해 들어오는 자연광"
      ],
      colorScheme: "따뜻한 브라운 톤, 크림색 벽면, 검은색 포인트",
      lighting: "부드러운 황색 조명과 자연광의 조화, 아늑한 분위기",
      furnitureLayout: "정면에 카운터, 왼쪽과 오른쪽에 2-4인용 테이블들이 자연스럽게 배치",
      wallsAndDecor: "밝은 크림색 벽면, 심플한 액자 몇 개, 그린 플랜트 장식",
      flooring: "어두운 원목 바닥재, 자연스러운 나무 질감",
      uniqueFeatures: [
        "카운터 위 메뉴보드",
        "창가 자리의 작은 화분들",
        "벽면의 원목 선반",
        "아늑한 코너 시트"
      ],
      atmosphereDetails: "차분하고 세련된 분위기, 따뜻한 커피 향기가 느껴지는 공간"
    };
  }
  
  /**
   * 🍽️ 레스토랑 디스크립터 생성
   */
  private static createRestaurantDescriptor(userPrompt: string): BackgroundDescriptor {
    return {
      primaryType: "고급스럽고 아늑한 레스토랑 내부",
      specificDetails: [
        "어두운 원목 테이블과 가죽 의자",
        "은은한 캔들 조명이 각 테이블마다 배치",
        "벽면의 와인랙과 고급스러운 인테리어",
        "부드러운 커튼과 따뜻한 벽면 조명",
        "개방형 주방이 보이는 뒤쪽 공간"
      ],
      colorScheme: "깊은 브라운과 골드 톤, 따뜻한 베이지 벽면",
      lighting: "디밍된 따뜻한 조명, 각 테이블의 캔들빛, 로맨틱한 분위기",
      furnitureLayout: "중앙과 벽면을 따라 배치된 2-4인용 테이블, 넓은 통로",
      wallsAndDecor: "따뜻한 베이지 벽면, 고급스러운 그림들, 와인과 관련된 장식",
      flooring: "짙은 원목 마루, 부분적으로 카펫이 깔린 구역",
      uniqueFeatures: [
        "벽면의 와인 진열장",
        "각 테이블의 캔들 조명",
        "고급스러운 테이블 세팅",
        "은은한 배경음악 스피커"
      ],
      atmosphereDetails: "로맨틱하고 고급스러운 분위기, 편안한 식사 공간"
    };
  }
  
  /**
   * 🏫 교실 디스크립터 생성
   */
  private static createClassroomDescriptor(userPrompt: string): BackgroundDescriptor {
    return {
      primaryType: "밝고 깨끗한 현대식 교실",
      specificDetails: [
        "정렬된 학생용 책상과 의자들",
        "전면의 화이트보드와 교사용 책상",
        "큰 창문들을 통한 자연채광",
        "뒤쪽 벽면의 게시판과 사물함들",
        "천장의 형광등 조명"
      ],
      colorScheme: "밝은 흰색과 베이지 톤, 깔끔한 파스텔 포인트",
      lighting: "밝은 형광등과 창문을 통한 자연광, 명쾌한 분위기",
      furnitureLayout: "정면에 교사용 책상, 6x5 배열의 학생 책상들",
      wallsAndDecor: "흰색 벽면, 교육용 포스터들, 뒤쪽 게시판",
      flooring: "밝은 회색 리놀륨 바닥, 깔끔하고 실용적인 마감",
      uniqueFeatures: [
        "전면 화이트보드",
        "창가의 화분들",
        "뒤쪽 사물함 줄",
        "시계와 일정표"
      ],
      atmosphereDetails: "밝고 학구적인 분위기, 집중하기 좋은 환경"
    };
  }
  
  /**
   * 🛋️ 거실 디스크립터 생성
   */
  private static createLivingRoomDescriptor(userPrompt: string): BackgroundDescriptor {
    return {
      primaryType: "편안하고 모던한 거실 공간",
      specificDetails: [
        "대형 소파와 커피 테이블이 중앙에 배치",
        "벽면의 대형 TV와 엔터테인먼트 유닛",
        "코너의 독서용 안락의자와 스탠드 조명",
        "큰 창문과 얇은 커튼",
        "벽면을 따라 배치된 책장과 장식품들"
      ],
      colorScheme: "뉴트럴 베이지와 그레이 톤, 따뜻한 우드 포인트",
      lighting: "천장의 은은한 조명과 스탠드 램프, 아늑한 분위기",
      furnitureLayout: "중앙의 소파 세트, 벽면 TV, 코너 독서 공간",
      wallsAndDecor: "밝은 베이지 벽면, 가족 사진들, 미니멀한 장식품",
      flooring: "따뜻한 원목 바닥, 부분적으로 러그가 깔림",
      uniqueFeatures: [
        "대형 소파와 쿠션들",
        "커피 테이블 위 장식품",
        "벽면의 가족 사진",
        "코너의 그린 플랜트"
      ],
      atmosphereDetails: "가정적이고 편안한 분위기, 휴식과 대화에 적합한 공간"
    };
  }
  
  /**
   * 🏢 일반 실내 디스크립터 생성
   */
  private static createGenericInteriorDescriptor(userPrompt: string): BackgroundDescriptor {
    return {
      primaryType: "현대적이고 깔끔한 실내 공간",
      specificDetails: [
        "심플한 가구들과 실용적인 배치",
        "깔끔한 인테리어와 정리된 공간",
        "적절한 조명과 통풍",
        "기능적이면서도 미적인 요소들"
      ],
      colorScheme: "뉴트럴 톤의 조화로운 색상 구성",
      lighting: "자연스럽고 편안한 조명 분위기",
      furnitureLayout: "기능적이고 효율적인 가구 배치",
      wallsAndDecor: "심플하고 깔끔한 벽면과 장식",
      flooring: "실용적이고 세련된 바닥재",
      uniqueFeatures: ["특별한 포인트 요소들"],
      atmosphereDetails: "편안하고 기능적인 현대적 공간"
    };
  }
  
  /**
   * 📝 배경 연속성 프롬프트 생성
   */
  static generateConsistencyPrompt(descriptor: BackgroundDescriptor): string {
    let prompt = '';
    
    prompt += `🏗️ [배경 정확한 재현 - 절대 변경 금지]\n`;
    prompt += `배경 타입: ${descriptor.primaryType}\n\n`;
    
    prompt += `구체적 디테일 (모두 동일하게 유지):\n`;
    descriptor.specificDetails.forEach((detail, index) => {
      prompt += `${index + 1}. ${detail}\n`;
    });
    prompt += '\n';
    
    prompt += `색상 구성: ${descriptor.colorScheme}\n`;
    prompt += `조명 설정: ${descriptor.lighting}\n`;
    prompt += `가구 배치: ${descriptor.furnitureLayout}\n`;
    prompt += `벽면과 장식: ${descriptor.wallsAndDecor}\n`;
    prompt += `바닥재: ${descriptor.flooring}\n\n`;
    
    if (descriptor.uniqueFeatures.length > 0) {
      prompt += `고유 특징들 (필수 포함):\n`;
      descriptor.uniqueFeatures.forEach((feature, index) => {
        prompt += `• ${feature}\n`;
      });
      prompt += '\n';
    }
    
    prompt += `전체 분위기: ${descriptor.atmosphereDetails}\n\n`;
    
    prompt += `⚠️ 위의 모든 배경 요소들을 정확히 동일하게 재현하세요.\n`;
    prompt += `⚠️ 배경의 어떤 요소도 변경하지 마세요.\n`;
    prompt += `⚠️ 오직 캐릭터의 행동과 포즈만 변경하세요.\n`;
    
    return prompt;
  }
}