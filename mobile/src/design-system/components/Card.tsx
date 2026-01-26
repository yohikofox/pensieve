import { View, type ViewProps, Platform } from 'react-native';
import { cn } from '../utils';
import { shadows } from '../tokens';

interface CardProps extends ViewProps {
  variant?: 'elevated' | 'outlined' | 'filled';
  className?: string;
  children: React.ReactNode;
}

const variantClassNames: Record<CardProps['variant'] & string, string> = {
  elevated: 'bg-white',
  outlined: 'bg-white border border-neutral-200',
  filled: 'bg-neutral-50',
};

export function Card({
  variant = 'elevated',
  className,
  children,
  style,
  ...props
}: CardProps) {
  return (
    <View
      className={cn('p-4 rounded-lg', variantClassNames[variant], className)}
      style={[
        variant === 'elevated' &&
          Platform.select({
            ios: shadows.base,
            android: { elevation: shadows.base.elevation },
          }),
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
