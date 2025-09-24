/**
 * Element Manager
 * 
 * 업로드된 이미지 요소들을 프롬프트에 통합하는 유틸리티
 */

// 요소 이미지 인터페이스 (ImageElementSelector와 동일)
interface ElementImage {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
}

interface ElementEnhancementOptions {
  selectedElements: ElementImage[];
  userPrompt: string;
}

/**
 * 저장된 이미지 요소들을 프롬프트에 간단하게 통합
 * @mention 패턴을 제거하여 텍스트/말풍선이 이미지에 나타나지 않도록 처리
 */
export function enhancePromptWithElements({ 
  selectedElements, 
  userPrompt 
}: ElementEnhancementOptions): string {
  // @mention 패턴 제거 - 실제 이미지는 별도로 Gemini에 전달됨
  let cleanPrompt = userPrompt;
  
  // @캐릭터이름, @요소이름 패턴을 제거
  cleanPrompt = cleanPrompt.replace(/@([가-힣a-zA-Z0-9]+)/g, '');
  
  // 연속된 공백을 하나로 정리
  cleanPrompt = cleanPrompt.replace(/\s+/g, ' ').trim();
  
  // 선택된 요소들에 대한 참조 설명 추가
  if (selectedElements.length > 0) {
    const elementReferences = selectedElements.map(element => {
      return `"${element.name}"${element.description ? ` (${element.description})` : ''}`;
    }).join(', ');
    
    cleanPrompt += `\n\n[Reference Elements]\nUse the provided reference images as inspiration for: ${elementReferences}. These images can represent backgrounds, objects, poses, styles, or any visual elements that should be incorporated into the scene.`;
  }
  
  console.log('🧹 프롬프트 정리:', userPrompt, '→', cleanPrompt);
  console.log('🖼️ 참조 요소:', selectedElements.length, '개');
  
  return cleanPrompt;
}

/**
 * 저장된 이미지 URL들을 반환 (Gemini API 전송용)
 */
export function getElementImageUrls(selectedElements: ElementImage[]): string[] {
  return selectedElements.map(element => element.imageUrl);
}

/**
 * 업로드된 이미지 요소에서 표시용 텍스트 추출
 */
export function getElementDisplayText(element: ElementImage): string {
  return element.description || "레퍼런스 이미지";
}

/**
 * 요소들을 카테고리별로 그룹화 (간소화됨)
 */
export function groupElementsByCategory(elements: ElementImage[]) {
  return {
    all: elements
  };
}