import { View, Text } from 'react-native';
import { cn } from '../utils';

type ProgressBarColor = 'primary' | 'success' | 'warning' | 'error';
type ProgressBarSize = 'sm' | 'md' | 'lg';

const colorStyles: Record<ProgressBarColor, string> = {
  primary: 'bg-primary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
};

const sizeStyles: Record<ProgressBarSize, string> = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

interface ProgressBarProps {
  progress: number; // 0 to 100
  color?: ProgressBarColor;
  size?: ProgressBarSize;
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function ProgressBar({
  progress,
  color = 'primary',
  size = 'md',
  showLabel = false,
  label,
  className,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <View className={cn('w-full', className)}>
      {(showLabel || label) && (
        <View className="flex-row justify-between items-center mb-1">
          {label && (
            <Text className="text-sm text-neutral-600">{label}</Text>
          )}
          {showLabel && (
            <Text className="text-sm font-medium text-neutral-700">
              {Math.round(clampedProgress)}%
            </Text>
          )}
        </View>
      )}
      <View className={cn('w-full bg-neutral-200 rounded-full overflow-hidden', sizeStyles[size])}>
        <View
          className={cn('h-full rounded-full', colorStyles[color])}
          style={{ width: `${clampedProgress}%` }}
        />
      </View>
    </View>
  );
}
