/**
 * 🔍 동적 장면 분석 시스템
 * 사용자 프롬프트에서 실제 배경/장면 정보를 추출하여 연속성 유지
 */

export interface SceneAnalysisResult {
  location: string;           // 추출된 장소 정보
  objects: string[];          // 감지된 오브젝트들
  lighting: string;           // 조명 분위기
  timeOfDay: string;          // 시간대
  mood: string;               // 전체적인 분위기
  settings: string[];         // 구체적인 설정 디테일
}

export interface CharacterAnalysisResult {
  physicalDetails: string[];  // 외모 특징
  clothing: string[];         // 의상 디테일
  accessories: string[];      // 액세서리
  pose: string;              // 자세/포즈
  action: string;            // 현재 행동
  expression: string;        // 표정/감정
}

export class DynamicSceneAnalyzer {
  
  /**
   * 🎯 사용자 프롬프트에서 장면 정보 추출
   */
  static analyzeSceneFromPrompt(userPrompt: string): SceneAnalysisResult {
    const prompt = userPrompt.toLowerCase();
    
    // 장소 키워드 감지
    const location = this.extractLocation(prompt);
    
    // 오브젝트 감지
    const objects = this.extractObjects(prompt);
    
    // 조명/시간 감지
    const { lighting, timeOfDay } = this.extractLightingAndTime(prompt);
    
    // 분위기 감지
    const mood = this.extractMood(prompt);
    
    // 구체적 설정 디테일
    const settings = this.extractSettings(prompt);
    
    return {
      location,
      objects,
      lighting,
      timeOfDay,
      mood,
      settings
    };
  }
  
  /**
   * 👤 사용자 프롬프트에서 캐릭터 정보 추출
   */
  static analyzeCharacterFromPrompt(userPrompt: string): CharacterAnalysisResult {
    const prompt = userPrompt.toLowerCase();
    
    return {
      physicalDetails: this.extractPhysicalDetails(prompt),
      clothing: this.extractClothing(prompt),
      accessories: this.extractAccessories(prompt),
      pose: this.extractPose(prompt),
      action: this.extractAction(prompt),
      expression: this.extractExpression(prompt)
    };
  }
  
  /**
   * 🏢 장소 추출
   */
  private static extractLocation(prompt: string): string {
    const locationKeywords = {
      '카페': '아늑한 카페 실내',
      '커피숍': '모던한 커피숍 내부', 
      '레스토랑': '세련된 레스토랑 실내',
      '음식점': '따뜻한 음식점 내부',
      '식당': '편안한 식당 분위기',
      '교실': '밝은 교실 내부',
      '학교': '학교 건물 내부',
      '집': '아늑한 집 안',
      '방': '개인적인 방 공간',
      '거실': '넓은 거실 공간',
      '부엌': '깔끔한 부엌 공간',
      '공원': '자연스러운 공원',
      '길': '도시의 거리',
      '상점': '밝은 상점 내부',
      '도서관': '조용한 도서관',
      '병원': '깔끔한 병원 내부',
      '사무실': '현대적인 사무실',
      '지하철': '지하철역 내부',
      '버스': '버스 내부 공간',
      '해변': '아름다운 해변가',
      '산': '자연스러운 산속',
      '호텔': '고급스러운 호텔',
      '백화점': '화려한 백화점',
      '마트': '넓은 마트 내부'
    };
    
    for (const [keyword, description] of Object.entries(locationKeywords)) {
      if (prompt.includes(keyword)) {
        return description;
      }
    }
    
    // 구체적인 장소 설명이 있는지 확인
    if (prompt.includes('실내') || prompt.includes('안에')) {
      return '실내 공간';
    }
    if (prompt.includes('밖') || prompt.includes('야외')) {
      return '야외 공간';
    }
    
    return '일반적인 실내 공간'; // 기본값
  }
  
  /**
   * 🪑 오브젝트 추출
   */
  private static extractObjects(prompt: string): string[] {
    const objectKeywords = [
      // 가구
      '책상', '의자', '테이블', '소파', '침대',
      // 음식/음료
      '커피', '음료', '음식', '케이크', '빵', '샌드위치', '파스타', '피자',
      '팝콘', '콜라', '주스', '물', '차',
      // 전자기기
      '컴퓨터', '노트북', '핸드폰', '스마트폰', 'tv', '모니터',
      // 학용품
      '책', '노트', '펜', '연필', '가방',
      // 기타
      '창문', '문', '그림', '포스터', '화분', '꽃',
      '램프', '조명', '시계', '거울'
    ];
    
    const foundObjects: string[] = [];
    
    objectKeywords.forEach(keyword => {
      if (prompt.includes(keyword)) {
        foundObjects.push(keyword);
      }
    });
    
    return foundObjects;
  }
  
  /**
   * 💡 조명과 시간 추출
   */
  private static extractLightingAndTime(prompt: string): { lighting: string; timeOfDay: string } {
    // 시간대 키워드
    let timeOfDay = '일반적인 시간';
    if (prompt.includes('아침') || prompt.includes('오전')) {
      timeOfDay = '아침, 밝은 자연광';
    } else if (prompt.includes('점심') || prompt.includes('낮') || prompt.includes('오후')) {
      timeOfDay = '오후, 따뜻한 햇살';
    } else if (prompt.includes('저녁') || prompt.includes('밤')) {
      timeOfDay = '저녁, 따뜻한 실내 조명';
    }
    
    // 조명 키워드
    let lighting = '자연스러운 조명';
    if (prompt.includes('밝은') || prompt.includes('환한')) {
      lighting = '밝고 화사한 조명';
    } else if (prompt.includes('어두운') || prompt.includes('흐린')) {
      lighting = '은은하고 차분한 조명';
    } else if (prompt.includes('따뜻한')) {
      lighting = '따뜻하고 포근한 조명';
    } else if (prompt.includes('햇살') || prompt.includes('햇빛')) {
      lighting = '자연스러운 햇살이 비치는 조명';
    }
    
    return { lighting, timeOfDay };
  }
  
  /**
   * 😊 분위기 추출  
   */
  private static extractMood(prompt: string): string {
    const moodKeywords = {
      '편안': '편안하고 아늑한 분위기',
      '아늑': '따뜻하고 아늑한 분위기',
      '밝은': '밝고 경쾌한 분위기',
      '즐거운': '즐겁고 활기찬 분위기',
      '평화': '평화롭고 고요한 분위기',
      '로맨틱': '로맨틱하고 달콤한 분위기',
      '긴장': '긴장감 있는 분위기',
      '신비': '신비롭고 몽환적인 분위기',
      '모던': '모던하고 세련된 분위기',
      '클래식': '클래식하고 우아한 분위기'
    };
    
    for (const [keyword, mood] of Object.entries(moodKeywords)) {
      if (prompt.includes(keyword)) {
        return mood;
      }
    }
    
    return '자연스럽고 일상적인 분위기';
  }
  
  /**
   * ⚙️ 구체적 설정 추출
   */
  private static extractSettings(prompt: string): string[] {
    const settings: string[] = [];
    
    // 색상 정보
    const colors = ['빨간', '파란', '노란', '초록', '보라', '분홍', '검은', '흰', '갈색', '회색'];
    colors.forEach(color => {
      if (prompt.includes(color)) {
        settings.push(`${color}색 포인트`);
      }
    });
    
    // 재질/텍스처
    const textures = ['나무', '금속', '플라스틱', '유리', '가죽', '천', '돌'];
    textures.forEach(texture => {
      if (prompt.includes(texture)) {
        settings.push(`${texture} 재질`);
      }
    });
    
    // 스타일
    if (prompt.includes('빈티지') || prompt.includes('레트로')) {
      settings.push('빈티지한 스타일');
    }
    if (prompt.includes('모던') || prompt.includes('현대')) {
      settings.push('모던한 스타일');
    }
    
    return settings;
  }
  
  /**
   * 👁️ 캐릭터 외모 추출
   */
  private static extractPhysicalDetails(prompt: string): string[] {
    const details: string[] = [];
    
    // 머리색
    const hairColors = ['금발', '갈색머리', '검은머리', '분홍머리', '파란머리', '보라머리'];
    hairColors.forEach(hair => {
      if (prompt.includes(hair) || prompt.includes(hair.replace('머리', ''))) {
        details.push(hair);
      }
    });
    
    // 헤어스타일
    const hairStyles = ['트윈테일', '포니테일', '단발', '긴머리', '곱슬머리'];
    hairStyles.forEach(style => {
      if (prompt.includes(style)) {
        details.push(style);
      }
    });
    
    // 눈색
    const eyeColors = ['갈색눈', '파란눈', '초록눈', '회색눈'];
    eyeColors.forEach(eye => {
      if (prompt.includes(eye) || prompt.includes(eye.replace('눈', ' 눈'))) {
        details.push(eye);
      }
    });
    
    return details;
  }
  
  /**
   * 👔 의상 추출
   */
  private static extractClothing(prompt: string): string[] {
    const clothing: string[] = [];
    
    const clothingItems = [
      '교복', '정장', '원피스', '치마', '바지', '청바지', '셔츠', '블라우스',
      '자켓', '코트', '가디건', '니트', '티셔츠', '후드', '조끼'
    ];
    
    clothingItems.forEach(item => {
      if (prompt.includes(item)) {
        clothing.push(item);
      }
    });
    
    return clothing;
  }
  
  /**
   * 💍 액세서리 추출
   */
  private static extractAccessories(prompt: string): string[] {
    const accessories: string[] = [];
    
    const accessoryItems = [
      '안경', '선글라스', '모자', '목걸이', '귀걸이', '시계', '반지',
      '팔찌', '리본', '머리띠', '스카프', '장갑', '가방', '신발'
    ];
    
    accessoryItems.forEach(item => {
      if (prompt.includes(item)) {
        accessories.push(item);
      }
    });
    
    return accessories;
  }
  
  /**
   * 🤸 포즈 추출
   */
  private static extractPose(prompt: string): string {
    const poses = {
      '앉아': '앉아있는 자세',
      '서서': '서있는 자세',
      '눕': '누워있는 자세',
      '기대': '기대고 있는 자세',
      '팔짱': '팔짱을 낀 자세',
      '손들': '손을 든 자세',
      '가리키': '가리키는 자세'
    };
    
    for (const [keyword, pose] of Object.entries(poses)) {
      if (prompt.includes(keyword)) {
        return pose;
      }
    }
    
    return '자연스러운 자세';
  }
  
  /**
   * 🏃 액션 추출
   */
  private static extractAction(prompt: string): string {
    const actions = {
      '먹': '음식을 먹고 있음',
      '마시': '음료를 마시고 있음',
      '읽': '책을 읽고 있음',
      '쓰': '글을 쓰고 있음',
      '말하': '대화를 하고 있음',
      '웃': '웃고 있음',
      '바라보': '바라보고 있음',
      '걷': '걷고 있음',
      '뛰': '뛰고 있음',
      '춤추': '춤을 추고 있음',
      '노래': '노래를 하고 있음'
    };
    
    for (const [keyword, action] of Object.entries(actions)) {
      if (prompt.includes(keyword)) {
        return action;
      }
    }
    
    return '자연스러운 행동을 하고 있음';
  }
  
  /**
   * 😄 표정 추출
   */
  private static extractExpression(prompt: string): string {
    const expressions = {
      '웃': '밝은 미소',
      '미소': '따뜻한 미소',
      '행복': '행복한 표정',
      '슬픈': '슬픈 표정',
      '화난': '화난 표정',
      '놀란': '놀란 표정',
      '당황': '당황한 표정',
      '집중': '집중하는 표정',
      '진지': '진지한 표정',
      '피곤': '피곤한 표정'
    };
    
    for (const [keyword, expression] of Object.entries(expressions)) {
      if (prompt.includes(keyword)) {
        return expression;
      }
    }
    
    return '자연스러운 표정';
  }
}