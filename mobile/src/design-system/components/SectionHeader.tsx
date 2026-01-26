import { View, Text } from 'react-native';
import { cn } from '../utils';

interface SectionHeaderProps {
  title: string;
  className?: string;
}

export function SectionHeader({ title, className }: SectionHeaderProps) {
  return (
    <View className={cn('px-4 pt-4 pb-2', className)}>
      <Text className="text-xs font-semibold text-neutral-400 uppercase">
        {title}
      </Text>
    </View>
  );
}
