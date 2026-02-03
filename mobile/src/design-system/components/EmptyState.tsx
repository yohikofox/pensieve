import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { cn } from '../utils';
import { colors } from '../tokens';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Feather.glyphMap;
  iconColor?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  iconColor,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <View className={cn('flex-1 items-center justify-center px-8 py-12', className)}>
      {icon && (
        <View className="w-20 h-20 rounded-full bg-bg-subtle items-center justify-center mb-6">
          <Feather name={icon} size={40} color={iconColor || colors.neutral[400]} />
        </View>
      )}

      <Text className="text-xl font-semibold text-text-primary text-center mb-2">
        {title}
      </Text>

      {description && (
        <Text className="text-base text-text-tertiary text-center mb-6">
          {description}
        </Text>
      )}

      {actionLabel && onAction && (
        <Button variant="primary" onPress={onAction}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}
