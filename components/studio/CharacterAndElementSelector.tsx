"use client";

import { CharacterSelector } from './CharacterSelector';
import { ImageElementSelector } from './ImageElementSelector';
import { cn } from "@/lib/utils";

interface CharacterAndElementSelectorProps {
  // Character props
  selectedCharacters: string[];
  onCharacterToggle: (characterId: string) => void;
  onAddCharacter?: () => void;
  onCharacterDelete?: (characterId: string) => void;
  refreshKey?: number;
  isGeneratingCharacter?: boolean;
  currentPanelIndex?: number;
  panelCharacterMap?: Map<number, string[]>;
  isAutoSelected?: boolean;
  generatingCharacterInfo?: {
    name: string;
    description: string;
  };
  
  // Element props
  selectedElements: any[]; // ElementImage array from ImageElementSelector
  onElementsChange: (elements: any[]) => void;
  
  className?: string;
}

export function CharacterAndElementSelector({
  // Character props
  selectedCharacters,
  onCharacterToggle,
  onAddCharacter,
  onCharacterDelete,
  refreshKey,
  isGeneratingCharacter,
  currentPanelIndex,
  panelCharacterMap,
  isAutoSelected,
  generatingCharacterInfo,
  
  // Element props
  selectedElements,
  onElementsChange,
  
  className
}: CharacterAndElementSelectorProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* 캐릭터 & 요소 선택 그리드 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 왼쪽: 캐릭터 선택 */}
        <div className="space-y-3">
          <CharacterSelector
            selectedCharacters={selectedCharacters}
            onCharacterToggle={onCharacterToggle}
            onAddCharacter={onAddCharacter}
            onCharacterDelete={onCharacterDelete}
            refreshKey={refreshKey}
            isGeneratingCharacter={isGeneratingCharacter}
            currentPanelIndex={currentPanelIndex}
            panelCharacterMap={panelCharacterMap}
            isAutoSelected={isAutoSelected}
            generatingCharacterInfo={generatingCharacterInfo}
            selectedElementsCount={selectedElements.length}
          />
        </div>

        {/* 오른쪽: 요소 선택 */}
        <div className="space-y-3">
          <ImageElementSelector
            selectedElements={selectedElements}
            onElementsChange={onElementsChange}
            selectedCharacters={selectedCharacters}
          />
        </div>
      </div>
    </div>
  );
}