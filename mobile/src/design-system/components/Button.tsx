import {
  TouchableOpacity,
  Text,
  View,
  ActivityIndicator,
  type TouchableOpacityProps,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { cn } from '../utils';
import { shadows, colors } from '../tokens';

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

// Using semantic theme-aware colors (CSS variables)
const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary-action active:bg-primary-hover',
  secondary: 'bg-bg-subtle active:bg-bg-screen border border-border-default',
  accent: 'bg-secondary-action active:bg-secondary-500',
  danger: 'bg-status-error active:bg-error-600',
  ghost: 'bg-transparent active:bg-bg-subtle',
};

const variantTextStyles: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-text-primary',
  accent: 'text-white',
  danger: 'text-white',
  ghost: 'text-primary-text',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-10 px-3',
  md: 'h-12 px-4',
  lg: 'h-14 px-5',
};

const sizeTextStyles: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

const variantIconColors: Record<ButtonVariant, string> = {
  primary: colors.neutral[0],
  secondary: colors.neutral[900],
  accent: colors.neutral[0],
  danger: colors.neutral[0],
  ghost: colors.primary[500],
};

const sizeIconSizes: Record<ButtonSize, number> = {
  sm: 14,
  md: 18,
  lg: 20,
};

interface ButtonProps extends TouchableOpacityProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: keyof typeof Feather.glyphMap;
  rightIcon?: keyof typeof Feather.glyphMap;
  className?: string;
  textClassName?: string;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  className,
  textClassName,
  children,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const iconColor = variantIconColors[variant];
  const iconSize = sizeIconSizes[size];

  return (
    <TouchableOpacity
      className={cn(
        'flex-row items-center justify-center rounded-base',
        variantStyles[variant],
        sizeStyles[size],
        isDisabled && 'opacity-50',
        className
      )}
      style={[
        (variant === 'primary' || variant === 'accent' || variant === 'danger') &&
          !isDisabled &&
          Platform.select({
            ios: shadows.sm,
            android: { elevation: shadows.sm.elevation },
          }),
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : '#3B82F6'}
          size="small"
        />
      ) : (
        <View className="flex-row items-center gap-1.5">
          {leftIcon && <Feather name={leftIcon} size={iconSize} color={iconColor} />}
          <Text
            className={cn(
              'font-semibold',
              variantTextStyles[variant],
              sizeTextStyles[size],
              textClassName
            )}
          >
            {children}
          </Text>
          {rightIcon && <Feather name={rightIcon} size={iconSize} color={iconColor} />}
        </View>
      )}
    </TouchableOpacity>
  );
}
