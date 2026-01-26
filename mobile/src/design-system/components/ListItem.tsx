import { View, Text, TouchableOpacity, type TouchableOpacityProps } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { cn } from '../utils';
import { colors } from '../tokens';

interface ListItemProps extends Omit<TouchableOpacityProps, 'children'> {
  title: string;
  subtitle?: string;
  leftIcon?: keyof typeof Feather.glyphMap;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  showBorder?: boolean;
  className?: string;
}

export function ListItem({
  title,
  subtitle,
  leftIcon,
  leftElement,
  rightElement,
  showChevron = false,
  showBorder = true,
  className,
  disabled,
  ...props
}: ListItemProps) {
  const content = (
    <View
      className={cn(
        'flex-row items-center py-3 px-4 bg-white',
        showBorder && 'border-b border-neutral-100',
        disabled && 'opacity-50',
        className
      )}
    >
      {leftElement && <View className="mr-3">{leftElement}</View>}

      {leftIcon && !leftElement && (
        <View className="w-8 h-8 rounded-full bg-neutral-100 items-center justify-center mr-3">
          <Feather name={leftIcon} size={18} color={colors.neutral[600]} />
        </View>
      )}

      <View className="flex-1">
        <Text className="text-base text-neutral-900" numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text className="text-sm text-neutral-400 mt-0.5" numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>

      {rightElement && <View className="ml-3">{rightElement}</View>}

      {showChevron && (
        <Feather name="chevron-right" size={20} color={colors.neutral[300]} />
      )}
    </View>
  );

  if (props.onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} disabled={disabled} {...props}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}
