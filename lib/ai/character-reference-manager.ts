import { prisma } from "@/lib/db/prisma";

/**
 * 캐릭터 레퍼런스 관리 시스템
 * 사용자가 등록한 캐릭터와 레퍼런스 이미지를 관리하고
 * 프롬프트에서 자동으로 캐릭터를 인식하여 매칭
 */

// 비율별 레퍼런스 이미지 타입 (새로운 구조)
export interface RatioImageData {
  url: string;
  width: number;
  height: number;
  generatedAt: string;
}

export interface RatioImages {
  '1:1'?: RatioImageData | string[]; // 새로운 구조와 기존 구조 둘 다 지원
  '4:5'?: RatioImageData | string[];
}

// 캐릭터 정보 타입
export interface CharacterReference {
  id: string;
  name: string;                    // 기본 이름 (예: "은진")
  aliases: string[];               // 별칭들 (예: ["은진이", "은진씨", "김은진"])
  description: string;             // 상세 설명
  visualFeatures: {
    hairColor: string;
    hairStyle: string;
    eyeColor: string;
    faceShape: string;
    bodyType: string;
    height: string;
    age: string;
    gender: string;
    skinTone: string;
    distinctiveFeatures: string[]; // 특징적인 요소들
  };
  clothing: {
    default: string;               // 기본 의상
    variations: string[];          // 의상 변형들
  };
  personality: string;             // 성격 (표정 생성에 도움)
  referenceImages: string[];       // 원본 레퍼런스 이미지 URL들
  ratioImages?: RatioImages;       // 비율별 처리된 이미지들
  lastUsed: Date;
  userId: string;
}

export class CharacterReferenceManager {
  private characterCache: Map<string, CharacterReference> = new Map();
  private nameToIdMap: Map<string, string> = new Map(); // 이름 -> ID 매핑
  
  /**
   * Supabase 클라이언트를 사용한 쿼리 실행
   */
  private async getSupabaseClient() {
    const { createClient } = await import('@supabase/supabase-js');
    // 서버사이드에서는 SERVICE_ROLE_KEY 사용 (RLS 우회)
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  
  /**
   * 캐릭터 등록 (비율별 이미지 처리 포함)
   */
  async registerCharacter(
    userId: string,
    character: Omit<CharacterReference, "id" | "lastUsed" | "userId">
  ): Promise<string> {
    try {
      console.log(`🎭 캐릭터 등록 시작: ${character.name}`);
      
      // 1. 먼저 캐릭터 정보를 DB에 저장
      const saved = await prisma.character.create({
        data: {
          userId,
          name: character.name,
          description: character.description,
          referenceImages: character.referenceImages,
          thumbnailUrl: character.referenceImages[0] || null,
        },
      });

      console.log(`✅ 캐릭터 기본 정보 저장 완료: ${saved.id}`);

      // 2. 비율별 이미지 처리는 별도의 API로 처리 (향후 구현)
      console.log(`🔄 비율별 이미지 처리는 별도 API에서 처리됩니다 (캐릭터 ${saved.id})`);
      // TODO: /api/characters/process-images API 구현하여 백그라운드에서 처리
      
      // 3. 캐시에 저장 (ratioImages는 나중에 업데이트)
      const fullCharacter: CharacterReference = {
        ...character,
        id: saved.id,
        userId,
        lastUsed: new Date(),
        ratioImages: undefined // 처리 중이므로 undefined
      };
      
      this.characterCache.set(saved.id, fullCharacter);
      
      // 4. 이름 매핑 업데이트
      this.updateNameMappings(fullCharacter);
      
      console.log(`🎉 캐릭터 등록 완료: ${saved.id} (비율별 이미지는 백그라운드에서 처리 중)`);
      return saved.id;
    } catch (error) {
      console.error("Character registration error:", error);
      throw new Error("캐릭터 등록 실패");
    }
  }
  
  /**
   * 이름 매핑 업데이트
   */
  private updateNameMappings(character: CharacterReference): void {
    // 기본 이름 매핑
    this.nameToIdMap.set(character.name.toLowerCase(), character.id);
    
    // 별칭 매핑
    character.aliases.forEach(alias => {
      this.nameToIdMap.set(alias.toLowerCase(), character.id);
    });
    
    // 이름 변형 자동 생성 및 매핑
    const variations = this.generateNameVariations(character.name);
    variations.forEach(variation => {
      this.nameToIdMap.set(variation.toLowerCase(), character.id);
    });
  }
  
  /**
   * 이름 변형 자동 생성
   * 예: "은진" → ["은진이", "은진씨", "은진님", "은진아", "은진이가", "은진이는"]
   */
  private generateNameVariations(name: string): string[] {
    const variations: string[] = [];
    
    // 한국어 조사/호칭 추가
    const suffixes = ["이", "씨", "님", "아", "야", "이가", "이는", "이를", "이와", "이한테", "에게"];
    const particles = ["가", "는", "를", "와", "한테", "에게", "의", "도", "만"];
    
    // 받침 확인 (간단한 체크)
    const lastChar = name.charCodeAt(name.length - 1);
    const hasJongsung = (lastChar - 0xAC00) % 28 !== 0;
    
    suffixes.forEach(suffix => {
      if (hasJongsung) {
        // 받침이 있는 경우
        if (suffix === "아" || suffix === "야") {
          variations.push(name + "아");
        } else if (suffix === "이" || suffix.startsWith("이")) {
          variations.push(name + suffix);
        } else {
          variations.push(name + suffix);
        }
      } else {
        // 받침이 없는 경우
        if (suffix === "아" || suffix === "야") {
          variations.push(name + "야");
        } else if (suffix === "이" || suffix.startsWith("이")) {
          variations.push(name + suffix.substring(1) || name);
        } else if (suffix !== "이") {
          variations.push(name + suffix);
        }
      }
    });
    
    // 조사 추가
    particles.forEach(particle => {
      if (hasJongsung) {
        if (particle === "가") variations.push(name + "이가");
        else if (particle === "는") variations.push(name + "이는");
        else if (particle === "를") variations.push(name + "을");
        else variations.push(name + particle);
      } else {
        variations.push(name + particle);
      }
    });
    
    // 영어 이름인 경우
    if (/^[A-Za-z]+$/.test(name)) {
      variations.push(name.toLowerCase());
      variations.push(name.toUpperCase());
      variations.push(name + "'s");
    }
    
    return [...new Set(variations)]; // 중복 제거
  }
  
  /**
   * 프롬프트에서 캐릭터 감지
   */
  detectCharactersInPrompt(prompt: string): {
    detectedCharacters: CharacterReference[];
    enhancedPrompt: string;
    characterMentions: Map<string, string[]>; // 캐릭터 ID -> 언급된 텍스트들
  } {
    const detectedCharacters: CharacterReference[] = [];
    const characterMentions = new Map<string, string[]>();
    let enhancedPrompt = prompt;
    
    // 모든 등록된 이름과 별칭을 검사
    for (const [nameVariant, characterId] of this.nameToIdMap.entries()) {
      // 대소문자 구분 없이 검색
      const regex = new RegExp(`\\b${this.escapeRegex(nameVariant)}\\b`, 'gi');
      const matches = prompt.match(regex);
      
      if (matches && matches.length > 0) {
        const character = this.characterCache.get(characterId);
        if (character && !detectedCharacters.find(c => c.id === characterId)) {
          detectedCharacters.push(character);
          
          // 언급된 텍스트 저장
          if (!characterMentions.has(characterId)) {
            characterMentions.set(characterId, []);
          }
          characterMentions.get(characterId)!.push(...matches);
          
          // 프롬프트에 캐릭터 마커 추가
          enhancedPrompt = enhancedPrompt.replace(
            regex,
            `[CHARACTER:${character.name}]$&[/CHARACTER]`
          );
        }
      }
    }
    
    return {
      detectedCharacters,
      enhancedPrompt,
      characterMentions,
    };
  }
  
  /**
   * 정규식 이스케이프
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * AI 프롬프트 생성용 캐릭터 설명 구성
   */
  buildCharacterDescriptionForAI(character: CharacterReference): string {
    const description = `
[캐릭터: ${character.name}]
=== 외모 특징 ===
- 머리: ${character.visualFeatures.hairColor} ${character.visualFeatures.hairStyle}
- 눈: ${character.visualFeatures.eyeColor}
- 얼굴형: ${character.visualFeatures.faceShape}
- 체형: ${character.visualFeatures.bodyType} (${character.visualFeatures.height})
- 나이: ${character.visualFeatures.age}
- 성별: ${character.visualFeatures.gender}
- 피부톤: ${character.visualFeatures.skinTone}
${character.visualFeatures.distinctiveFeatures.length > 0 ? 
  `- 특징: ${character.visualFeatures.distinctiveFeatures.join(', ')}` : ''}

=== 의상 ===
- 기본: ${character.clothing.default}
${character.clothing.variations.length > 0 ?
  `- 변형: ${character.clothing.variations.join(', ')}` : ''}

=== 성격 ===
${character.personality}

=== 중요 ===
이 캐릭터가 등장할 때마다 위의 특징을 정확히 유지해야 합니다.
별칭: ${character.aliases.join(', ')}
`;
    
    return description;
  }
  
  /**
   * 프롬프트 자동 향상
   */
  async enhancePromptWithCharacters(
    userId: string,
    originalPrompt: string
  ): Promise<{
    enhancedPrompt: string;
    detectedCharacters: CharacterReference[];
    characterDescriptions: string;
    referenceImages: string[];
  }> {
    // 사용자의 캐릭터 로드
    await this.loadUserCharacters(userId);
    
    // 프롬프트에서 캐릭터 감지
    const detection = this.detectCharactersInPrompt(originalPrompt);
    
    // 캐릭터 설명 생성
    let characterDescriptions = "";
    const referenceImages: string[] = [];
    
    detection.detectedCharacters.forEach(character => {
      characterDescriptions += this.buildCharacterDescriptionForAI(character) + "\n\n";
      
      // 레퍼런스 이미지 추가 (캐릭터당 1개만)
      referenceImages.push(...character.referenceImages.slice(0, 1));
    });
    
    // ⚠️ 전체 레퍼런스 이미지를 최대 3개로 제한 (Google AI Studio 토큰 한도 고려)
    const limitedReferenceImages = referenceImages.slice(0, 3);
    if (referenceImages.length > 3) {
      console.warn(`⚠️ 감지된 캐릭터의 레퍼런스 이미지가 ${referenceImages.length}개에서 3개로 제한됨`);
    }
    
    // 향상된 프롬프트 생성
    let enhancedPrompt = detection.enhancedPrompt;
    
    // 캐릭터가 감지되었다면 명확한 지시 추가
    if (detection.detectedCharacters.length > 0) {
      enhancedPrompt = `
${enhancedPrompt}

[캐릭터 일관성 요구사항]
위에 언급된 캐릭터들은 제공된 레퍼런스와 정확히 일치해야 합니다.
각 캐릭터의 고유한 특징을 반드시 유지하세요.
`;
    }
    
    return {
      enhancedPrompt,
      detectedCharacters: detection.detectedCharacters,
      characterDescriptions,
      referenceImages: limitedReferenceImages, // 제한된 이미지 사용
    };
  }
  
  /**
   * 선택된 캐릭터 ID들로 프롬프트 향상 (프로젝트 비율 맞춤)
   */
  async enhancePromptWithSelectedCharacters(
    userId: string,
    originalPrompt: string,
    selectedCharacterIds: string[],
    projectRatio?: '4:5' | '1:1' | '16:9'
  ): Promise<{
    enhancedPrompt: string;
    detectedCharacters: CharacterReference[];
    characterDescriptions: string;
    referenceImages: string[];
  }> {
    // 사용자의 캐릭터 로드
    await this.loadUserCharacters(userId);
    
    // 선택된 캐릭터들 가져오기
    const selectedCharacters: CharacterReference[] = [];
    for (const characterId of selectedCharacterIds) {
      const character = this.characterCache.get(characterId);
      if (character) {
        selectedCharacters.push(character);
      }
    }
    
    console.log(`🎯 선택된 캐릭터 로딩 완료: ${selectedCharacters.length}/${selectedCharacterIds.length}개`);
    console.log(`📐 프로젝트 비율: ${projectRatio || '기본값'}`);
    
    // 캐릭터 설명 생성
    let characterDescriptions = "";
    const referenceImages: string[] = [];
    
    selectedCharacters.forEach(character => {
      characterDescriptions += this.buildCharacterDescriptionForAI(character) + "\n\n";
      
      // ⭐ 캐릭터당 1개 이미지만 사용 (Google AI Studio 3개 제한 고려)
      const ratioSpecificImages = this.selectRatioSpecificImages(character, projectRatio);
      referenceImages.push(...ratioSpecificImages.slice(0, 1)); // 캐릭터당 1개
    });
    
    // ⚠️ Google AI Studio 멀티모달 최대 제한: 3개 이미지
    const limitedImages = referenceImages.slice(0, 3);
    if (referenceImages.length > 3) {
      console.warn(`⚠️ 레퍼런스 이미지가 ${referenceImages.length}개에서 3개로 제한됨 (Google AI Studio 멀티모달 제한)`);
    }
    
    // 향상된 프롬프트 생성
    let enhancedPrompt = originalPrompt;
    
    // 선택된 캐릭터가 있다면 간단한 프롬프트만 추가 (nano-banana-service에서 처리)
    if (selectedCharacters.length > 0) {
      enhancedPrompt = `${originalPrompt}

[Character Reference Note: ${selectedCharacters.length} characters with reference images provided]`;
    }
    
    console.log(`📸 비율별 레퍼런스 이미지 선택 완료: ${limitedImages.length}개 (최대 3개 제한)`);
    
    return {
      enhancedPrompt,
      detectedCharacters: selectedCharacters,
      characterDescriptions,
      referenceImages: limitedImages, // 제한된 이미지 사용
    };
  }

  /**
   * 프로젝트 비율에 맞는 캐릭터 레퍼런스 이미지 선택
   */
  private selectRatioSpecificImages(
    character: CharacterReference, 
    projectRatio?: '4:5' | '1:1' | '16:9'
  ): string[] {
    // ratioImages가 있고 프로젝트 비율이 지정되어 있다면 해당 비율 이미지 사용
    if (character.ratioImages && projectRatio) {
      const ratioKey = projectRatio === '16:9' ? '4:5' : projectRatio; // 16:9는 4:5 이미지 사용
      const ratioSpecificData = character.ratioImages[ratioKey];
      
      if (ratioSpecificData) {
        // 새로운 구조인지 확인 (RatioImageData 객체)
        if (typeof ratioSpecificData === 'object' && !Array.isArray(ratioSpecificData) && 'url' in ratioSpecificData) {
          console.log(`🎯 캐릭터 ${character.name}: ${ratioKey} 비율 이미지 1개 사용 (새로운 구조)`);
          return [ratioSpecificData.url];
        }
        // 기존 구조인지 확인 (string[]) - 첫 번째 이미지만 사용
        else if (Array.isArray(ratioSpecificData) && ratioSpecificData.length > 0) {
          console.log(`🎯 캐릭터 ${character.name}: ${ratioKey} 비율 이미지 1개 사용 (기존 구조)`);
          return [ratioSpecificData[0]]; // 첫 번째 이미지만
        } else {
          console.warn(`⚠️ 캐릭터 ${character.name}: ${ratioKey} 비율 이미지 구조가 잘못되어 원본 이미지 사용`);
        }
      } else {
        console.warn(`⚠️ 캐릭터 ${character.name}: ${ratioKey} 비율 이미지가 없어서 원본 이미지 첫 번째 사용`);
      }
    }
    
    // ratioImages가 없거나 비율이 지정되지 않았다면 원본 이미지 첫 번째만 사용
    console.log(`📷 캐릭터 ${character.name}: 원본 이미지 첫 번째 1개 사용`);
    return character.referenceImages.length > 0 ? [character.referenceImages[0]] : []; // 첫 번째 이미지만
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    console.log(`🗑️ 캐릭터 캐시 초기화`);
    this.characterCache.clear();
    this.nameToIdMap.clear();
  }

  /**
   * 사용자의 모든 캐릭터 로드 (ratioImages 포함)
   */
  async loadUserCharacters(userId: string): Promise<void> {
    try {
      // 캐시 초기화 (최신 데이터 보장)
      this.clearCache();
      
      // Supabase 클라이언트를 사용하여 데이터 조회 (Prisma 연결 문제 우회)
      console.log(`📚 사용자 캐릭터 + 시스템 캐릭터 로딩 시작: userId=${userId}`);

      const supabase = await this.getSupabaseClient();

      // 1. 실제 사용자 조회 (실제 서비스 준비 완료)
      const { data: users, error: userError } = await supabase
        .from('user')
        .select('id')
        .eq('id', userId)
        .limit(1);
        
      if (userError || !users || users.length === 0) {
        console.warn(`⚠️ 사용자를 찾을 수 없음: ${userId}`, userError);
        console.log(`📚 캐릭터 로딩 완료: 0개 (사용자 없음)`);
        return;
      }
      
      const targetUserId = users[0].id;
      console.log(`👤 사용자 확인: ${targetUserId}`);

      // 2. 해당 사용자의 캐릭터들 조회
      const { data: characters, error: characterError } = await supabase
        .from('character')
        .select('*')
        .eq('userId', targetUserId)
        .order('createdAt', { ascending: false });

      if (characterError) {
        console.error('캐릭터 조회 오류:', characterError);
        console.log(`📚 캐릭터 로딩 완료: 0개 (오류 발생)`);
        return;
      }

      if (!characters || characters.length === 0) {
        console.log(`📚 캐릭터 로딩 완료: 0개`);
        return;
      }
      
      characters.forEach(char => {
        const metadata = (char as any).metadata as any;
        const ratioImages = (char as any).ratioImages as RatioImages | null;
        
        const characterRef: CharacterReference = {
          id: char.id,
          name: char.name,
          aliases: metadata?.aliases || [char.name], // 기본값으로 이름 추가
          description: char.description,
          visualFeatures: metadata?.visualFeatures || {
            hairColor: "",
            hairStyle: "",
            eyeColor: "",
            faceShape: "",
            bodyType: "",
            height: "",
            age: "",
            gender: "",
            skinTone: "",
            distinctiveFeatures: []
          },
          clothing: metadata?.clothing || { default: "", variations: [] },
          personality: metadata?.personality || "",
          referenceImages: char.referenceImages as string[] || [],
          ratioImages: ratioImages || undefined,
          lastUsed: char.updatedAt,
          userId: char.userId,
        };
        
        this.characterCache.set(char.id, characterRef);
        this.updateNameMappings(characterRef);
        
        console.log(`🎭 캐릭터 로드: ${char.name} (${char.id}), 레퍼런스 이미지: ${characterRef.referenceImages.length}개, 비율별 이미지: ${ratioImages ? Object.keys(ratioImages).length : 0}개`);
      });
      
      console.log(`📚 캐릭터 로딩 완료: ${characters.length}개 (사용자 + 시스템 캐릭터)`);
    } catch (error) {
      console.error("Error loading user characters:", error);
      console.log(`📚 캐릭터 로딩 완료: 0개 (오류 발생)`);
    }
  }

  
  /**
   * 캐릭터 정보 업데이트
   */
  async updateCharacter(
    characterId: string,
    updates: Partial<CharacterReference>
  ): Promise<void> {
    try {
      const character = this.characterCache.get(characterId);
      if (!character) {
        throw new Error("캐릭터를 찾을 수 없습니다");
      }
      
      // 캐시 업데이트
      const updated = { ...character, ...updates };
      this.characterCache.set(characterId, updated);
      
      // 이름 매핑 재구성
      if (updates.name || updates.aliases) {
        // 기존 매핑 제거
        for (const [name, id] of this.nameToIdMap.entries()) {
          if (id === characterId) {
            this.nameToIdMap.delete(name);
          }
        }
        // 새 매핑 추가
        this.updateNameMappings(updated);
      }
      
      // DB 업데이트
      await prisma.character.update({
        where: { id: characterId },
        data: {
          name: updated.name,
          description: updated.description,
          referenceImages: updated.referenceImages as any,
        },
      });
    } catch (error) {
      console.error("Character update error:", error);
      throw new Error("캐릭터 업데이트 실패");
    }
  }
  
  /**
   * 캐릭터 사용 통계 업데이트
   */
  async recordCharacterUsage(characterIds: string[]): Promise<void> {
    const now = new Date();
    
    for (const id of characterIds) {
      const character = this.characterCache.get(id);
      if (character) {
        character.lastUsed = now;
        
        // DB 업데이트 (비동기)
        prisma.character.update({
          where: { id },
          data: { updatedAt: now },
        }).catch(console.error);
      }
    }
  }
  
  /**
   * 자주 사용하는 캐릭터 조회
   */
  async getFrequentlyUsedCharacters(
    userId: string,
    limit: number = 5
  ): Promise<CharacterReference[]> {
    await this.loadUserCharacters(userId);
    
    const userCharacters = Array.from(this.characterCache.values())
      .filter(c => c.userId === userId)
      .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
      .slice(0, limit);
    
    return userCharacters;
  }
}

// 싱글톤 인스턴스
export const characterReferenceManager = new CharacterReferenceManager();