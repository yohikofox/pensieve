import { View, Text, Image, type ImageSourcePropType } from 'react-native';
import { cn } from '../utils';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizeStyles: Record<AvatarSize, { container: string; text: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-xs' },
  sm: { container: 'w-8 h-8', text: 'text-sm' },
  md: { container: 'w-10 h-10', text: 'text-base' },
  lg: { container: 'w-12 h-12', text: 'text-lg' },
  xl: { container: 'w-16 h-16', text: 'text-xl' },
};

interface AvatarProps {
  source?: ImageSourcePropType;
  name?: string;
  size?: AvatarSize;
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getColorFromName(name: string): string {
  const colors = [
    'bg-primary-500',
    'bg-secondary-500',
    'bg-success-500',
    'bg-warning-500',
    'bg-info-500',
    'bg-error-500',
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ source, name, size = 'md', className }: AvatarProps) {
  const sizeConfig = sizeStyles[size];

  if (source) {
    return (
      <Image
        source={source}
        className={cn(
          'rounded-full',
          sizeConfig.container,
          className
        )}
        resizeMode="cover"
      />
    );
  }

  const initials = name ? getInitials(name) : '?';
  const bgColor = name ? getColorFromName(name) : 'bg-neutral-400';

  return (
    <View
      className={cn(
        'rounded-full items-center justify-center',
        sizeConfig.container,
        bgColor,
        className
      )}
    >
      <Text className={cn('font-semibold text-white', sizeConfig.text)}>
        {initials}
      </Text>
    </View>
  );
}
