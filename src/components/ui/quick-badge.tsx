import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function QuickBadge({ className, size = 'md' }: QuickBadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-0.5',
    md: 'text-xs px-2 py-1 gap-1',
    lg: 'text-sm px-3 py-1.5 gap-1.5',
  };

  const iconSizes = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full bg-quick text-quick-foreground',
        sizeClasses[size],
        className
      )}
    >
      <Zap className={cn(iconSizes[size], 'fill-current')} />
      Quick
    </span>
  );
}
