import React, { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { cn } from '../utils';
import { colors, shadows } from '../tokens';
import { NavigationIcons } from '../icons';

type AccordionVariant = 'default' | 'primary' | 'warning' | 'info';

const variantStyles: Record<AccordionVariant, {
  container: string;
  header: string;
  headerBorder: string;
  title: string;
  content: string;
  iconColor: string;
}> = {
  default: {
    container: 'bg-neutral-100 border-neutral-200',
    header: '',
    headerBorder: 'border-neutral-200',
    title: 'text-neutral-600',
    content: 'bg-neutral-50',
    iconColor: colors.neutral[500],
  },
  primary: {
    container: 'bg-primary-50 border-primary-200',
    header: '',
    headerBorder: 'border-primary-200',
    title: 'text-primary-700',
    content: 'bg-white',
    iconColor: colors.primary[600],
  },
  warning: {
    container: 'bg-warning-50 border-warning-200',
    header: '',
    headerBorder: 'border-warning-200',
    title: 'text-warning-700',
    content: 'bg-warning-50',
    iconColor: colors.warning[600],
  },
  info: {
    container: 'bg-info-50 border-info-200',
    header: '',
    headerBorder: 'border-info-200',
    title: 'text-info-700',
    content: 'bg-white',
    iconColor: colors.info[600],
  },
};

interface AccordionProps {
  /** Title displayed in the header */
  title: string;
  /** Icon name from Feather icons */
  icon?: keyof typeof Feather.glyphMap;
  /** Color variant */
  variant?: AccordionVariant;
  /** Whether the accordion is expanded (controlled mode) */
  expanded?: boolean;
  /** Default expanded state (uncontrolled mode) */
  defaultExpanded?: boolean;
  /** Callback when expanded state changes */
  onToggle?: (expanded: boolean) => void;
  /** Custom icon color override */
  iconColor?: string;
  /** Content to display when expanded */
  children: React.ReactNode;
  /** Additional className for container */
  className?: string;
}

export function Accordion({
  title,
  icon,
  variant = 'default',
  expanded: controlledExpanded,
  defaultExpanded = false,
  onToggle,
  iconColor,
  children,
  className,
}: AccordionProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  const styles = variantStyles[variant];
  const chevronColor = iconColor ?? styles.iconColor;
  const titleIconColor = iconColor ?? styles.iconColor;

  const handleToggle = () => {
    const newValue = !isExpanded;
    if (!isControlled) {
      setInternalExpanded(newValue);
    }
    onToggle?.(newValue);
  };

  return (
    <View
      className={cn(
        'rounded-lg border overflow-hidden',
        styles.container,
        className
      )}
    >
      <Pressable
        className={cn(
          'flex-row justify-between items-center p-3',
          styles.header
        )}
        onPress={handleToggle}
      >
        <View className="flex-row items-center flex-1">
          {icon && (
            <Feather
              name={icon}
              size={16}
              color={titleIconColor}
              style={{ marginRight: 8 }}
            />
          )}
          <Text className={cn('text-sm font-semibold', styles.title)}>
            {title}
          </Text>
        </View>
        <Feather
          name={isExpanded ? NavigationIcons.down : NavigationIcons.forward}
          size={16}
          color={chevronColor}
        />
      </Pressable>

      {isExpanded && (
        <View
          className={cn(
            'border-t p-3',
            styles.headerBorder,
            styles.content
          )}
        >
          {children}
        </View>
      )}
    </View>
  );
}
