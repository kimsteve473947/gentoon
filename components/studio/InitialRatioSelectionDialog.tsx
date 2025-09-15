'use client';

import { useState, useEffect } from 'react';
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
  Sparkles
} from "lucide-react";

type CanvasRatio = '4:5' | '1:1';

const CANVAS_SIZES = {
  '4:5': { label: '세로형', actualWidth: 1080, actualHeight: 1350, description: '인스타그램 스토리에 최적화된 세로형 비율' },
  '1:1': { label: '정사각형', actualWidth: 1080, actualHeight: 1080, description: '인스타그램 정사각형 포스트 비율' },
};

interface InitialRatioSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (selectedRatio: CanvasRatio) => void;
  onCancel: () => void;
  currentRatio?: CanvasRatio;
}

export function InitialRatioSelectionDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  currentRatio = '4:5'
}: InitialRatioSelectionDialogProps) {
  const [selectedRatio, setSelectedRatio] = useState<CanvasRatio>(currentRatio);
  const [isConfirming, setIsConfirming] = useState(false);

  // currentRatio prop이 변경되면 selectedRatio 상태를 업데이트
  useEffect(() => {
    setSelectedRatio(currentRatio);
  }, [currentRatio]);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm(selectedRatio);
      onOpenChange(false);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };


  const ratioData = CANVAS_SIZES[selectedRatio];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <DialogTitle>첫 번째 이미지를 생성하시겠습니까?</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            현재 선택된 <strong className="text-purple-600">{ratioData.label} ({ratioData.actualWidth} × {ratioData.actualHeight}px)</strong> 비율로 첫 번째 이미지를 생성합니다.<br /><br />
            <strong className="text-amber-600">⚠️ 첫 이미지 생성 후에는 이 작업공간에서 비율 변경이 불가능합니다.</strong>
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
                생성 중...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {ratioData.label}으로 생성하기
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}