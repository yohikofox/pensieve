import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { cn } from '../utils';
import { colors } from '../tokens';

type ChipVariant = 'filled' | 'outlined';
type ChipColor = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral';

const variantColorStyles: Record<ChipVariant, Record<ChipColor, { container: string; text: string }>> = {
  filled: {
    primary: { container: 'bg-primary-100', text: 'text-primary-700' },
    secondary: { container: 'bg-secondary-100', text: 'text-secondary-700' },
    success: { container: 'bg-success-100', text: 'text-success-700' },
    warning: { container: 'bg-warning-100', text: 'text-warning-700' },
    error: { container: 'bg-error-100', text: 'text-error-700' },
    neutral: { container: 'bg-neutral-100', text: 'text-neutral-700' },
  },
  outlined: {
    primary: { container: 'border border-primary-300 bg-transparent', text: 'text-primary-600' },
    secondary: { container: 'border border-secondary-300 bg-transparent', text: 'text-secondary-600' },
    success: { container: 'border border-success-300 bg-transparent', text: 'text-success-600' },
    warning: { container: 'border border-warning-300 bg-transparent', text: 'text-warning-600' },
    error: { container: 'border border-error-300 bg-transparent', text: 'text-error-600' },
    neutral: { container: 'border border-neutral-300 bg-transparent', text: 'text-neutral-600' },
  },
};

const iconColors: Record<ChipColor, string> = {
  primary: colors.primary[600],
  secondary: colors.secondary[600],
  success: colors.success[600],
  warning: colors.warning[600],
  error: colors.error[600],
  neutral: colors.neutral[600],
};

interface ChipProps {
  label: string;
  variant?: ChipVariant;
  color?: ChipColor;
  icon?: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  onRemove?: () => void;
  className?: string;
}

export function Chip({
  label,
  variant = 'filled',
  color = 'neutral',
  icon,
  onPress,
  onRemove,
  className,
}: ChipProps) {
  const styles = variantColorStyles[variant][color];

  const content = (
    <View
      className={cn(
        'flex-row items-center px-3 py-1.5 rounded-full',
        styles.container,
        className
      )}
    >
      {icon && (
        <Feather
          name={icon}
          size={14}
          color={iconColors[color]}
          style={{ marginRight: 4 }}
        />
      )}
      <Text className={cn('text-sm font-medium', styles.text)}>{label}</Text>
      {onRemove && (
        <TouchableOpacity
          onPress={onRemove}
          className="ml-1 -mr-1"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="x" size={14} color={iconColors[color]} />
        </TouchableOpacity>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}
