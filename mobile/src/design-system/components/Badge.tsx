import { View, Text } from 'react-native';
import { cn } from '../utils';

type BadgeVariant = 'pending' | 'processing' | 'ready' | 'failed' | 'neutral';

const variantStyles: Record<BadgeVariant, string> = {
  pending: 'bg-warning-50 border-warning-200 dark:bg-warning-900 dark:border-warning-700',
  processing: 'bg-info-50 border-info-200 dark:bg-info-900 dark:border-info-700',
  ready: 'bg-success-50 border-success-200 dark:bg-success-900 dark:border-success-700',
  failed: 'bg-error-50 border-error-200 dark:bg-error-900 dark:border-error-700',
  neutral: 'bg-neutral-100 border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700',
};

const variantTextStyles: Record<BadgeVariant, string> = {
  pending: 'text-warning-700 dark:text-warning-300',
  processing: 'text-info-700 dark:text-info-300',
  ready: 'text-success-700 dark:text-success-300',
  failed: 'text-error-700 dark:text-error-300',
  neutral: 'text-neutral-700 dark:text-neutral-300',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <View
      className={cn('px-2 py-1 rounded-sm border', variantStyles[variant], className)}
    >
      <Text className={cn('text-xs font-medium', variantTextStyles[variant])}>
        {children}
      </Text>
    </View>
  );
}
