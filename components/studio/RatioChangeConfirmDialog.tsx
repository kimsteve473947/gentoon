'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Square, 
  RectangleVertical,
  AlertTriangle
} from "lucide-react";

type CanvasRatio = '4:5' | '1:1';

const CANVAS_SIZES = {
  '4:5': { label: '세로형', actualWidth: 1080, actualHeight: 1350 },
  '1:1': { label: '정사각형', actualWidth: 1080, actualHeight: 1080 },
};

interface RatioChangeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRatio: CanvasRatio;
  targetRatio: CanvasRatio;
  onConfirm: (targetRatio: CanvasRatio) => void;
  onCancel: () => void;
}

export function RatioChangeConfirmDialog({
  open,
  onOpenChange,
  currentRatio,
  targetRatio,
  onConfirm,
  onCancel
}: RatioChangeConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm(targetRatio);
      onOpenChange(false);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const getRatioIcon = (ratio: CanvasRatio) => {
    switch (ratio) {
      case '4:5':
        return <RectangleVertical className="h-5 w-5" />;
      case '1:1':
        return <Square className="h-5 w-5" />;
    }
  };

  const currentSizes = CANVAS_SIZES[currentRatio];
  const targetSizes = CANVAS_SIZES[targetRatio];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle>새로운 스튜디오에서 다른 비율로 웹툰을 그리시겠습니까?</DialogTitle>
          </div>
          <DialogDescription className="text-left space-y-3">
            <p>
              현재 <strong>{currentSizes.label}</strong> 비율에서 <strong>{targetSizes.label}</strong> 비율로 변경하려고 합니다.
            </p>
            <p className="text-sm text-slate-600">
              비율 변경 시 새로운 스튜디오 세션이 시작되며, 현재 작업 내용은 자동으로 저장됩니다.
            </p>
            
            {/* 비율 변경 정보 */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  {getRatioIcon(currentRatio)}
                  <span className="font-medium">{currentSizes.label}</span>
                  <span className="text-slate-500">
                    {currentSizes.actualWidth} × {currentSizes.actualHeight}px
                  </span>
                </div>
                <div className="text-slate-400">→</div>
                <div className="flex items-center gap-2 text-sm">
                  {getRatioIcon(targetRatio)}
                  <span className="font-medium text-purple-600">{targetSizes.label}</span>
                  <span className="text-purple-500">
                    {targetSizes.actualWidth} × {targetSizes.actualHeight}px
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                💡 <strong>참고:</strong> 새로운 비율의 스튜디오가 열리며, 캐릭터 설정과 선택은 그대로 유지됩니다.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isConfirming}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirming}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isConfirming ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                새 스튜디오 여는 중...
              </>
            ) : (
              `${targetSizes.label}으로 새 스튜디오 시작`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}