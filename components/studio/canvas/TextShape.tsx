import React, { useRef, useEffect, useState } from 'react';
import { Text, Transformer } from 'react-konva';
import Konva from 'konva';
import { TextLayer } from '@/types/editor';

interface TextShapeProps {
  layer: TextLayer;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (attrs: Partial<TextLayer>) => void;
  isDraggable: boolean;
}

export function TextShape({ 
  layer, 
  isSelected, 
  onSelect, 
  onChange,
  isDraggable 
}: TextShapeProps) {
  const textRef = useRef<Konva.Text>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isSelected && transformerRef.current && textRef.current) {
      transformerRef.current.nodes([textRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const handleDblClick = () => {
    if (layer.locked) return;
    
    setIsEditing(true);
    const textNode = textRef.current;
    if (!textNode) return;

    // 텍스트 노드 숨기기
    textNode.hide();
    transformerRef.current?.hide();

    // 텍스트 편집을 위한 textarea 생성
    const stage = textNode.getStage();
    if (!stage) return;
    
    const stageBox = stage.container().getBoundingClientRect();
    const textPosition = textNode.getAbsolutePosition();
    const stageTransform = stage.getAbsoluteTransform().copy();
    stageTransform.invert();
    const areaPosition = stageTransform.point(textPosition);

    // textarea 생성 및 스타일 설정
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    textarea.value = layer.text;
    textarea.style.position = 'absolute';
    textarea.style.top = `${stageBox.top + areaPosition.y}px`;
    textarea.style.left = `${stageBox.left + areaPosition.x}px`;
    textarea.style.width = `${textNode.width() - textNode.padding() * 2}px`;
    textarea.style.height = `${textNode.height() - textNode.padding() * 2 + 5}px`;
    textarea.style.fontSize = `${layer.fontSize}px`;
    textarea.style.fontFamily = layer.fontFamily;
    textarea.style.fontWeight = layer.fontWeight;
    textarea.style.fontStyle = layer.fontStyle;
    textarea.style.lineHeight = layer.lineHeight.toString();
    textarea.style.letterSpacing = `${layer.letterSpacing}px`;
    textarea.style.border = '2px solid #4299e1';
    textarea.style.borderRadius = '4px';
    textarea.style.padding = '4px';
    textarea.style.margin = '0px';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'rgba(255, 255, 255, 0.95)';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.transformOrigin = 'left top';
    textarea.style.textAlign = layer.textAlign;
    textarea.style.color = layer.color;
    textarea.style.zIndex = '9999';

    // 텍스트 회전 적용
    const rotation = textNode.rotation();
    let transform = '';
    if (rotation) {
      transform += `rotateZ(${rotation}deg)`;
    }
    
    const scale = stage.scaleX();
    transform += ` scale(${scale})`;
    
    textarea.style.transform = transform;

    textarea.focus();
    textarea.select();

    // 텍스트 변경 처리
    const handleTextareaBlur = () => {
      onChange({ text: textarea.value });
      setIsEditing(false);
      
      // textarea 제거
      document.body.removeChild(textarea);
      
      // 텍스트 노드 다시 표시
      textNode.show();
      if (isSelected) {
        transformerRef.current?.show();
      }
      
      textNode.getLayer()?.batchDraw();
    };

    textarea.addEventListener('blur', handleTextareaBlur);
    
    // Enter 키로 편집 완료 (Shift+Enter는 줄바꿈)
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        textarea.blur();
      }
      // Escape 키로 취소
      if (e.key === 'Escape') {
        textarea.value = layer.text;
        textarea.blur();
      }
    });

    // 자동 높이 조절
    const adjustHeight = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    };
    
    textarea.addEventListener('input', adjustHeight);
    adjustHeight();
  };

  return (
    <>
      <Text
        ref={textRef}
        x={layer.x}
        y={layer.y}
        text={layer.text}
        fontSize={layer.fontSize}
        fontFamily={layer.fontFamily}
        fontStyle={`${layer.fontWeight} ${layer.fontStyle}`}
        fill={layer.color}
        align={layer.textAlign}
        lineHeight={layer.lineHeight}
        letterSpacing={layer.letterSpacing}
        draggable={isDraggable && !layer.locked && !isEditing}
        visible={!isEditing}
        rotation={layer.rotation}
        opacity={layer.opacity}
        onDragEnd={(e) => {
          onChange({
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onClick={onSelect}
        onTap={onSelect}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
      />
      
      {isSelected && !isEditing && (
        <Transformer
          ref={transformerRef}
          enabledAnchors={['middle-left', 'middle-right']}
          boundBoxFunc={(oldBox, newBox) => {
            // 최소 너비 제한
            if (newBox.width < 20) {
              return oldBox;
            }
            return newBox;
          }}
          onTransformEnd={(e) => {
            const node = textRef.current;
            if (!node) return;
            
            const scaleX = node.scaleX();
            
            onChange({
              x: node.x(),
              y: node.y(),
              fontSize: Math.max(8, layer.fontSize * scaleX),
              rotation: node.rotation(),
            });
            
            node.scaleX(1);
            node.scaleY(1);
          }}
        />
      )}
    </>
  );
}