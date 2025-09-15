"use client";

import { memo, useMemo } from 'react';
import { BubbleTemplateRenderer } from './BubbleTemplateRenderer';
import { BUBBLE_TEMPLATES } from './BubbleTemplates';

interface VirtualizedTemplateListProps {
  selectedCategory: string;
  onTemplateSelect: (templateId: string) => void;
  onDragStart: (e: React.DragEvent, templateId: string) => void;
  onDragEnd: () => void;
  isDraggingBubble: boolean;
  draggedBubbleId: string | null;
}

// 템플릿 목록 가상화 컴포넌트
export const VirtualizedTemplateList = memo(({
  selectedCategory,
  onTemplateSelect,
  onDragStart,
  onDragEnd,
  isDraggingBubble,
  draggedBubbleId
}: VirtualizedTemplateListProps) => {
  
  // 필터링된 템플릿 메모이제이션
  const filteredTemplates = useMemo(() => 
    BUBBLE_TEMPLATES.filter(template => 
      selectedCategory === 'all' || template.category === selectedCategory
    ), 
    [selectedCategory]
  );

  return (
    <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
      {filteredTemplates.map(template => (
        <TemplateItem
          key={template.id}
          template={template}
          onSelect={onTemplateSelect}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          isDragging={isDraggingBubble && draggedBubbleId === template.id}
        />
      ))}
    </div>
  );
});

// 템플릿 아이템 컴포넌트 메모이제이션
const TemplateItem = memo(({ 
  template, 
  onSelect, 
  onDragStart, 
  onDragEnd, 
  isDragging 
}: {
  template: any;
  onSelect: (templateId: string) => void;
  onDragStart: (e: React.DragEvent, templateId: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) => (
  <div
    className={`relative group cursor-pointer border border-slate-200 rounded-lg p-3 hover:border-purple-300 hover:bg-purple-50 transition-all ${
      isDragging ? 'opacity-50' : ''
    }`}
    draggable={true}
    onDragStart={(e) => onDragStart(e, template.id)}
    onDragEnd={onDragEnd}
    onClick={() => onSelect(template.id)}
  >
    <div className="h-16 w-full flex items-center justify-center">
      <BubbleTemplateRenderer
        templateId={template.id}
        className="w-full h-full"
      />
    </div>
    <p className="text-xs text-center mt-1 text-slate-600">{template.name}</p>
    <div className="absolute inset-0 bg-purple-500 bg-opacity-10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
      <span className="text-xs text-purple-700 font-medium">드래그 또는 클릭</span>
    </div>
  </div>
));

VirtualizedTemplateList.displayName = 'VirtualizedTemplateList';
TemplateItem.displayName = 'TemplateItem';