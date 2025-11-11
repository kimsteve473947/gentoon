'use client';

import React, { memo } from 'react';
import { MoreVertical, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface ActionItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'warning';
  disabled?: boolean;
  separator?: boolean; // 이 아이템 뒤에 구분선 표시
}

export interface ActionDropdownProps {
  actions: ActionItem[];
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
}

const variantStyles = {
  default: 'text-gray-700 hover:text-gray-900',
  destructive: 'text-red-600 hover:text-red-700 focus:text-red-600',
  warning: 'text-yellow-600 hover:text-yellow-700 focus:text-yellow-600',
} as const;

/**
 * 재사용 가능한 액션 드롭다운 컴포넌트
 * 카드나 목록 항목에서 사용할 수 있는 액션 메뉴를 제공합니다.
 */
export const ActionDropdown = memo<ActionDropdownProps>(({
  actions,
  trigger,
  align = 'end',
  side = 'bottom',
  className,
  triggerClassName,
  contentClassName,
  disabled = false,
}) => {
  const defaultTrigger = (
    <Button 
      variant="ghost" 
      size="sm" 
      className={cn(
        "h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-sm",
        triggerClassName
      )}
      disabled={disabled}
    >
      <MoreVertical className="h-4 w-4" />
    </Button>
  );

  return (
    <div className={cn("inline-block", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger || defaultTrigger}
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align={align} 
          side={side}
          className={cn("w-48 z-[9999]", contentClassName)}
        >
          {actions.map((action, index) => (
            <React.Fragment key={action.id}>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  action.onClick();
                }}
                disabled={action.disabled}
                className={cn(
                  "cursor-pointer flex items-center gap-2",
                  variantStyles[action.variant || 'default']
                )}
              >
                {action.icon && (
                  <action.icon className="h-4 w-4" />
                )}
                <span>{action.label}</span>
              </DropdownMenuItem>
              {action.separator && index < actions.length - 1 && (
                <DropdownMenuSeparator />
              )}
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

ActionDropdown.displayName = 'ActionDropdown';

/**
 * 카드에 사용할 수 있는 호버 액션 드롭다운
 */
export const CardActionDropdown = memo<Omit<ActionDropdownProps, 'className' | 'triggerClassName'>>(({
  actions,
  ...props
}) => {
  return (
    <div className="absolute top-2 right-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <ActionDropdown
        actions={actions}
        triggerClassName="h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-sm"
        {...props}
      />
    </div>
  );
});

CardActionDropdown.displayName = 'CardActionDropdown';

/**
 * 공통 액션 아이템 팩토리 함수들
 */
export const createActionItems = {
  edit: (onClick: () => void): ActionItem => ({
    id: 'edit',
    label: '편집',
    onClick,
  }),
  
  duplicate: (onClick: () => void): ActionItem => ({
    id: 'duplicate', 
    label: '복제',
    onClick,
  }),
  
  download: (onClick: () => void): ActionItem => ({
    id: 'download',
    label: '다운로드',
    onClick,
  }),
  
  share: (onClick: () => void): ActionItem => ({
    id: 'share',
    label: '공유',
    onClick,
  }),
  
  moveToTrash: (onClick: () => void): ActionItem => ({
    id: 'moveToTrash',
    label: '휴지통으로 이동',
    onClick,
    variant: 'destructive',
    separator: true,
  }),
  
  delete: (onClick: () => void): ActionItem => ({
    id: 'delete',
    label: '영구 삭제',
    onClick,
    variant: 'destructive',
    separator: true,
  }),
  
  restore: (onClick: () => void): ActionItem => ({
    id: 'restore',
    label: '복원',
    onClick,
  }),
  
  archive: (onClick: () => void): ActionItem => ({
    id: 'archive',
    label: '보관',
    onClick,
    variant: 'warning',
  }),
} as const;