import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { cn } from '../utils';

type TextVariant = 'body' | 'bodySmall' | 'caption' | 'title' | 'titleLarge' | 'heading' | 'label';
type TextColor = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'link' | 'error' | 'success';

const variantStyles: Record<TextVariant, string> = {
  body: 'text-base leading-normal',
  bodySmall: 'text-sm leading-normal',
  caption: 'text-xs leading-normal',
  title: 'text-lg font-semibold leading-tight',
  titleLarge: 'text-xl font-bold leading-tight',
  heading: 'text-2xl font-bold leading-tight',
  label: 'text-sm font-medium leading-tight',
};

const colorStyles: Record<TextColor, string> = {
  primary: 'text-neutral-900',
  secondary: 'text-neutral-500',
  tertiary: 'text-neutral-400',
  inverse: 'text-white',
  link: 'text-primary-500',
  error: 'text-error-500',
  success: 'text-success-500',
};

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: TextColor;
  className?: string;
  children: React.ReactNode;
}

export function Text({
  variant = 'body',
  color = 'primary',
  className,
  children,
  ...props
}: TextProps) {
  return (
    <RNText
      className={cn(variantStyles[variant], colorStyles[color], className)}
      {...props}
    >
      {children}
    </RNText>
  );
}
