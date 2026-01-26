import { View, Text } from 'react-native';
import { cn } from '../utils';

type BadgeVariant = 'pending' | 'processing' | 'ready' | 'failed' | 'neutral';

const variantStyles: Record<BadgeVariant, string> = {
  pending: 'bg-warning-50 border-warning-200',
  processing: 'bg-info-50 border-info-200',
  ready: 'bg-success-50 border-success-200',
  failed: 'bg-error-50 border-error-200',
  neutral: 'bg-neutral-100 border-neutral-200',
};

const variantTextStyles: Record<BadgeVariant, string> = {
  pending: 'text-warning-700',
  processing: 'text-info-700',
  ready: 'text-success-700',
  failed: 'text-error-700',
  neutral: 'text-neutral-700',
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
