import { View, Text } from 'react-native';
import { cn } from '../utils';

type BadgeVariant = 'pending' | 'processing' | 'ready' | 'failed' | 'neutral';

// Using semantic theme-aware colors (CSS variables)
const variantStyles: Record<BadgeVariant, string> = {
  pending: 'bg-status-warning-bg border-status-warning-border',
  processing: 'bg-status-info-bg border-status-info-border',
  ready: 'bg-status-success-bg border-status-success-border',
  failed: 'bg-status-error-bg border-status-error-border',
  neutral: 'bg-bg-subtle border-border-default',
};

const variantTextStyles: Record<BadgeVariant, string> = {
  pending: 'text-status-warning-text',
  processing: 'text-status-info-text',
  ready: 'text-status-success-text',
  failed: 'text-status-error-text',
  neutral: 'text-text-secondary',
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
