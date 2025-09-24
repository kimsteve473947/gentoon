"use client";

import React, { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreVertical, Trash2 } from "lucide-react";

interface ActionMenuItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  deleteAction?: {
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText: string;
  };
  className?: string;
  buttonClassName?: string;
  align?: "start" | "end" | "center";
}

export function ActionMenu({
  items,
  deleteAction,
  className,
  buttonClassName,
  align = "end"
}: ActionMenuProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const handleDeleteClick = () => {
    if (deleteAction) {
      setShowDeleteConfirm(true);
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteAction) {
      deleteAction.onConfirm();
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <div className={className}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`h-8 w-8 p-0 bg-white/90 backdrop-blur shadow-sm ${buttonClassName}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={align}>
            {items.length > 0 && (
              <>
                <DropdownMenuLabel>관리</DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            
            {items.map((item, index) => (
              <DropdownMenuItem
                key={index}
                onClick={item.onClick}
                disabled={item.disabled}
                className={item.variant === "destructive" ? "text-red-600 focus:text-red-600" : ""}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            ))}
            
            {deleteAction && (
              <>
                {items.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={handleDeleteClick}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  쓰레기통으로 이동
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {deleteAction && (
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteAction.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteAction.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {deleteAction.confirmText}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}