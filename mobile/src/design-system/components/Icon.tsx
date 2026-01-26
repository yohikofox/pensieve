/**
 * Icon Component
 *
 * Wrapper around Feather icons with design system integration
 */

import { Feather } from '@expo/vector-icons';
import { colors } from '../tokens';
import { IconSizes, type IconName, type IconSize } from '../icons';

type IconColor =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'muted'
  | 'inverse'
  | string;

const colorMap: Record<string, string> = {
  primary: colors.primary[500],
  secondary: colors.neutral[600],
  success: colors.success[500],
  warning: colors.warning[500],
  error: colors.error[500],
  info: colors.info[500],
  muted: colors.neutral[400],
  inverse: colors.neutral[0],
};

interface IconProps {
  name: IconName;
  size?: IconSize | number;
  color?: IconColor;
  className?: string;
}

export function Icon({ name, size = 'md', color = 'secondary' }: IconProps) {
  const iconSize = typeof size === 'number' ? size : IconSizes[size];
  const iconColor = colorMap[color] || color;

  return <Feather name={name} size={iconSize} color={iconColor} />;
}
