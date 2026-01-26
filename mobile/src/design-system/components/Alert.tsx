import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { cn } from '../utils';
import { colors } from '../tokens';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

const variantStyles: Record<AlertVariant, { container: string; text: string; icon: keyof typeof Feather.glyphMap; iconColor: string }> = {
  info: {
    container: 'bg-info-50 border-info-200',
    text: 'text-info-700',
    icon: 'info',
    iconColor: colors.info[500],
  },
  success: {
    container: 'bg-success-50 border-success-200',
    text: 'text-success-700',
    icon: 'check-circle',
    iconColor: colors.success[500],
  },
  warning: {
    container: 'bg-warning-50 border-warning-200',
    text: 'text-warning-700',
    icon: 'alert-triangle',
    iconColor: colors.warning[500],
  },
  error: {
    container: 'bg-error-50 border-error-200',
    text: 'text-error-700',
    icon: 'alert-circle',
    iconColor: colors.error[500],
  },
};

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: {
    label: string;
    onPress: () => void;
  };
  className?: string;
}

export function Alert({
  variant = 'info',
  title,
  message,
  dismissible = false,
  onDismiss,
  action,
  className,
}: AlertProps) {
  const styles = variantStyles[variant];

  return (
    <View
      className={cn(
        'flex-row items-start p-3 rounded-lg border',
        styles.container,
        className
      )}
    >
      <Feather
        name={styles.icon}
        size={20}
        color={styles.iconColor}
        style={{ marginTop: 2 }}
      />

      <View className="flex-1 ml-3">
        {title && (
          <Text className={cn('text-base font-semibold mb-0.5', styles.text)}>
            {title}
          </Text>
        )}
        <Text className={cn('text-sm', styles.text)}>{message}</Text>

        {action && (
          <TouchableOpacity onPress={action.onPress} className="mt-2">
            <Text className={cn('text-sm font-semibold underline', styles.text)}>
              {action.label}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {dismissible && onDismiss && (
        <TouchableOpacity
          onPress={onDismiss}
          className="ml-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={18} color={styles.iconColor} />
        </TouchableOpacity>
      )}
    </View>
  );
}
