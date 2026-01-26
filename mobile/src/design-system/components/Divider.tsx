import { View } from 'react-native';
import { cn } from '../utils';

type DividerVariant = 'full' | 'inset' | 'middle';

const variantStyles: Record<DividerVariant, string> = {
  full: '',
  inset: 'ml-4',
  middle: 'mx-4',
};

interface DividerProps {
  variant?: DividerVariant;
  className?: string;
}

export function Divider({ variant = 'full', className }: DividerProps) {
  return (
    <View
      className={cn(
        'h-px bg-neutral-200',
        variantStyles[variant],
        className
      )}
    />
  );
}
