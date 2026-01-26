import { cn } from '@/lib/utils';
import { MonthlyGoal, MONTHLY_GOALS } from '@/types/database';

interface GoalBadgeProps {
  goal: MonthlyGoal;
  className?: string;
  size?: 'sm' | 'md';
  showEmoji?: boolean;
}

export function GoalBadge({ goal, className, size = 'md', showEmoji = true }: GoalBadgeProps) {
  const goalInfo = MONTHLY_GOALS.find((g) => g.value === goal);
  
  if (!goalInfo) return null;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
  };

  const colorClasses: Record<string, string> = {
    'goal-keto': 'bg-goal-keto/10 text-goal-keto border-goal-keto/20',
    'goal-cuisines': 'bg-goal-cuisines/10 text-goal-cuisines border-goal-cuisines/20',
    'goal-veggies': 'bg-goal-veggies/10 text-goal-veggies border-goal-veggies/20',
    'goal-protein': 'bg-goal-protein/10 text-goal-protein border-goal-protein/20',
    'goal-fiber': 'bg-goal-fiber/10 text-goal-fiber border-goal-fiber/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        sizeClasses[size],
        colorClasses[goalInfo.color],
        className
      )}
    >
      {showEmoji && <span className="mr-1">{goalInfo.emoji}</span>}
      {goalInfo.label}
    </span>
  );
}
