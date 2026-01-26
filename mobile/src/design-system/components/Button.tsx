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

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary-500 active:bg-primary-600 dark:bg-primary-600 dark:active:bg-primary-700',
  secondary: 'bg-neutral-100 active:bg-neutral-200 border border-neutral-200 dark:bg-neutral-700 dark:active:bg-neutral-600 dark:border-neutral-600',
  accent: 'bg-secondary-500 active:bg-secondary-600 dark:bg-secondary-600 dark:active:bg-secondary-700',
  danger: 'bg-error-500 active:bg-error-600 dark:bg-error-600 dark:active:bg-error-700',
  ghost: 'bg-transparent active:bg-neutral-100 dark:active:bg-neutral-800',
};

const variantTextStyles: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-neutral-900 dark:text-neutral-50',
  accent: 'text-white',
  danger: 'text-white',
  ghost: 'text-primary-500 dark:text-primary-400',
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
