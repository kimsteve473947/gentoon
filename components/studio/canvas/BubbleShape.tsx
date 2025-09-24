import React, { useRef, useEffect } from 'react';
import { Group, Path, Rect, Ellipse, Transformer } from 'react-konva';
import Konva from 'konva';
import { BubbleLayer } from '@/types/editor';

interface BubbleShapeProps {
  layer: BubbleLayer;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (attrs: Partial<BubbleLayer>) => void;
  isDraggable: boolean;
}

export function BubbleShape({ 
  layer, 
  isSelected, 
  onSelect, 
  onChange,
  isDraggable 
}: BubbleShapeProps) {
  const shapeRef = useRef<any>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && transformerRef.current && shapeRef.current) {
      transformerRef.current.nodes([shapeRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const renderBubbleShape = () => {
    const { width = 200, height = 100 } = layer;

    switch (layer.style) {
      case 'round':
        return (
          <Ellipse
            ref={shapeRef}
            radiusX={width / 2}
            radiusY={height / 2}
            fill={layer.backgroundColor}
            stroke={layer.borderColor}
            strokeWidth={layer.borderWidth}
          />
        );

      case 'rectangle':
        return (
          <Rect
            ref={shapeRef}
            width={width}
            height={height}
            cornerRadius={5}
            fill={layer.backgroundColor}
            stroke={layer.borderColor}
            strokeWidth={layer.borderWidth}
          />
        );

      case 'cloud':
        // 구름 모양 말풍선 경로
        const cloudPath = `
          M ${width * 0.2},${height * 0.5}
          C ${width * 0.1},${height * 0.2} ${width * 0.3},${height * 0.1} ${width * 0.5},${height * 0.2}
          C ${width * 0.6},${height * 0.05} ${width * 0.8},${height * 0.05} ${width * 0.85},${height * 0.25}
          C ${width * 0.95},${height * 0.3} ${width * 0.95},${height * 0.5} ${width * 0.85},${height * 0.6}
          C ${width * 0.9},${height * 0.8} ${width * 0.7},${height * 0.9} ${width * 0.5},${height * 0.85}
          C ${width * 0.3},${height * 0.9} ${width * 0.15},${height * 0.8} ${width * 0.2},${height * 0.5}
          Z
        `;
        return (
          <Path
            ref={shapeRef}
            data={cloudPath}
            fill={layer.backgroundColor}
            stroke={layer.borderColor}
            strokeWidth={layer.borderWidth}
          />
        );

      case 'jagged':
        // 톱니 모양 말풍선
        const jaggedPath = `
          M ${width * 0.1},${height * 0.2}
          L ${width * 0.2},${height * 0.05}
          L ${width * 0.3},${height * 0.15}
          L ${width * 0.4},${height * 0.02}
          L ${width * 0.5},${height * 0.1}
          L ${width * 0.6},${height * 0.03}
          L ${width * 0.7},${height * 0.12}
          L ${width * 0.8},${height * 0.04}
          L ${width * 0.9},${height * 0.2}
          L ${width * 0.95},${height * 0.3}
          L ${width * 0.92},${height * 0.4}
          L ${width * 0.98},${height * 0.5}
          L ${width * 0.93},${height * 0.6}
          L ${width * 0.96},${height * 0.7}
          L ${width * 0.9},${height * 0.8}
          L ${width * 0.8},${height * 0.92}
          L ${width * 0.7},${height * 0.85}
          L ${width * 0.6},${height * 0.95}
          L ${width * 0.5},${height * 0.88}
          L ${width * 0.4},${height * 0.96}
          L ${width * 0.3},${height * 0.87}
          L ${width * 0.2},${height * 0.94}
          L ${width * 0.1},${height * 0.8}
          L ${width * 0.05},${height * 0.7}
          L ${width * 0.08},${height * 0.6}
          L ${width * 0.02},${height * 0.5}
          L ${width * 0.07},${height * 0.4}
          L ${width * 0.04},${height * 0.3}
          Z
        `;
        return (
          <Path
            ref={shapeRef}
            data={jaggedPath}
            fill={layer.backgroundColor}
            stroke={layer.borderColor}
            strokeWidth={layer.borderWidth}
          />
        );

      default:
        return null;
    }
  };

  const renderTail = () => {
    if (!layer.tailPosition || layer.bubbleType === 'narration') return null;

    const { width = 200, height = 100 } = layer;
    const { x: tailX, y: tailY } = layer.tailPosition;

    // 말풍선 꼬리 경로 생성
    let tailPath = '';
    
    if (layer.bubbleType === 'thought') {
      // 생각 말풍선은 동그란 꼬리
      return (
        <>
          <Ellipse
            x={tailX}
            y={tailY}
            radiusX={8}
            radiusY={8}
            fill={layer.backgroundColor}
            stroke={layer.borderColor}
            strokeWidth={layer.borderWidth}
          />
          <Ellipse
            x={tailX + 15}
            y={tailY + 15}
            radiusX={5}
            radiusY={5}
            fill={layer.backgroundColor}
            stroke={layer.borderColor}
            strokeWidth={layer.borderWidth}
          />
          <Ellipse
            x={tailX + 25}
            y={tailY + 25}
            radiusX={3}
            radiusY={3}
            fill={layer.backgroundColor}
            stroke={layer.borderColor}
            strokeWidth={layer.borderWidth}
          />
        </>
      );
    } else {
      // 일반 말풍선 꼬리
      const centerX = width / 2;
      const centerY = height / 2;
      
      tailPath = `
        M ${centerX - 10},${height - 5}
        L ${tailX},${tailY}
        L ${centerX + 10},${height - 5}
        Z
      `;
      
      return (
        <Path
          data={tailPath}
          fill={layer.backgroundColor}
          stroke={layer.borderColor}
          strokeWidth={layer.borderWidth}
        />
      );
    }
  };

  return (
    <Group
      x={layer.x}
      y={layer.y}
      rotation={layer.rotation}
      draggable={isDraggable && !layer.locked}
      onDragEnd={(e) => {
        onChange({
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      onClick={onSelect}
      onTap={onSelect}
    >
      {renderBubbleShape()}
      {renderTail()}
      
      {isSelected && transformerRef.current && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // 최소 크기 제한
            if (newBox.width < 50 || newBox.height < 30) {
              return oldBox;
            }
            return newBox;
          }}
          onTransformEnd={(e) => {
            const node = shapeRef.current;
            if (!node) return;
            
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            
            onChange({
              x: node.x(),
              y: node.y(),
              width: Math.max(50, node.width() * scaleX),
              height: Math.max(30, node.height() * scaleY),
              rotation: node.rotation(),
            });
            
            node.scaleX(1);
            node.scaleY(1);
          }}
        />
      )}
    </Group>
  );
}