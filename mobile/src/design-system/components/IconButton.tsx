import { TouchableOpacity, type TouchableOpacityProps, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { cn } from '../utils';
import { colors, shadows } from '../tokens';

type IconButtonSize = 'sm' | 'md' | 'lg' | 'xl';
type IconButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const sizeStyles: Record<IconButtonSize, { container: string; iconSize: number }> = {
  sm: { container: 'w-8 h-8', iconSize: 16 },
  md: { container: 'w-10 h-10', iconSize: 20 },
  lg: { container: 'w-12 h-12', iconSize: 24 },
  xl: { container: 'w-16 h-16', iconSize: 32 },
};

const variantStyles: Record<IconButtonVariant, { container: string; iconColor: string }> = {
  primary: { container: 'bg-primary-500 active:bg-primary-600', iconColor: colors.neutral[0] },
  secondary: { container: 'bg-neutral-100 active:bg-neutral-200', iconColor: colors.neutral[700] },
  ghost: { container: 'bg-transparent active:bg-neutral-100', iconColor: colors.neutral[600] },
  danger: { container: 'bg-error-500 active:bg-error-600', iconColor: colors.neutral[0] },
};

interface IconButtonProps extends Omit<TouchableOpacityProps, 'children'> {
  icon: keyof typeof Feather.glyphMap;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  color?: string;
  className?: string;
}

export function IconButton({
  icon,
  size = 'md',
  variant = 'secondary',
  color,
  className,
  disabled,
  style,
  ...props
}: IconButtonProps) {
  const sizeConfig = sizeStyles[size];
  const variantConfig = variantStyles[variant];
  const iconColor = color ?? variantConfig.iconColor;
  const showShadow = variant === 'primary' && !disabled;

  return (
    <TouchableOpacity
      className={cn(
        'rounded-full items-center justify-center',
        sizeConfig.container,
        variantConfig.container,
        disabled && 'opacity-50',
        className
      )}
      style={[
        showShadow &&
          Platform.select({
            ios: shadows.sm,
            android: { elevation: shadows.sm.elevation },
          }),
        style,
      ]}
      disabled={disabled}
      activeOpacity={0.8}
      {...props}
    >
      <Feather name={icon} size={sizeConfig.iconSize} color={iconColor} />
    </TouchableOpacity>
  );
}
