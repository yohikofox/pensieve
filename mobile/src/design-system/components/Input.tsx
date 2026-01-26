import { View, TextInput, Text, type TextInputProps } from 'react-native';
import { cn } from '../utils';
import { colors } from '../tokens';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  className?: string;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  hint,
  className,
  containerClassName,
  ...props
}: InputProps) {
  const hasError = Boolean(error);

  return (
    <View className={cn('gap-1', containerClassName)}>
      {label && (
        <Text className="text-sm font-medium text-neutral-700 mb-1">{label}</Text>
      )}
      <TextInput
        className={cn(
          'h-11 px-3 rounded-base border bg-white text-base text-neutral-900',
          hasError ? 'border-error-500' : 'border-neutral-200',
          'focus:border-primary-500',
          className
        )}
        placeholderTextColor={colors.neutral[400]}
        {...props}
      />
      {error && <Text className="text-xs text-error-500 mt-1">{error}</Text>}
      {hint && !error && (
        <Text className="text-xs text-neutral-400 mt-1">{hint}</Text>
      )}
    </View>
  );
}
