import { View, Text, TouchableOpacity, type TouchableOpacityProps, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { cn } from '../utils';
import { colors } from '../tokens';

interface SettingsRowBaseProps {
  title: string;
  subtitle?: string;
  icon?: string;
  showBorder?: boolean;
  className?: string;
}

interface SettingsRowNavigateProps extends SettingsRowBaseProps, Omit<TouchableOpacityProps, 'children'> {
  type: 'navigate';
  value?: string;
  onPress: () => void;
}

interface SettingsRowToggleProps extends SettingsRowBaseProps {
  type: 'toggle';
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

interface SettingsRowActionProps extends SettingsRowBaseProps, Omit<TouchableOpacityProps, 'children'> {
  type: 'action';
  actionLabel?: string;
  actionColor?: 'primary' | 'danger' | 'success';
  loading?: boolean;
  onPress: () => void;
}

interface SettingsRowInfoProps extends SettingsRowBaseProps {
  type: 'info';
  value?: string;
}

type SettingsRowProps =
  | SettingsRowNavigateProps
  | SettingsRowToggleProps
  | SettingsRowActionProps
  | SettingsRowInfoProps;

const actionColors = {
  primary: 'text-primary-500',
  danger: 'text-error-500',
  success: 'text-success-500',
};

export function SettingsRow(props: SettingsRowProps) {
  const { title, subtitle, icon, showBorder = true, className } = props;

  const content = (
    <View
      className={cn(
        'flex-row items-center py-3 px-4',
        showBorder && 'border-b border-neutral-200 dark:border-neutral-700',
        className
      )}
    >
      {icon && (
        <Text className="text-lg mr-2">{icon}</Text>
      )}

      <View className="flex-1">
        <Text
          className={cn(
            'text-lg',
            props.type === 'action' && props.actionColor === 'danger'
              ? 'text-error-500 dark:text-error-400'
              : 'text-neutral-900 dark:text-neutral-50'
          )}
        >
          {title}
        </Text>
        {subtitle && (
          <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{subtitle}</Text>
        )}
      </View>

      {props.type === 'navigate' && (
        <View className="flex-row items-center">
          {props.value && (
            <Text className="text-base text-neutral-400 dark:text-neutral-500 mr-1">{props.value}</Text>
          )}
          <Text className="text-xl text-neutral-300 dark:text-neutral-600 font-semibold">›</Text>
        </View>
      )}

      {props.type === 'toggle' && (
        <Switch
          value={props.value}
          onValueChange={props.onValueChange}
          disabled={props.disabled}
          trackColor={{ false: colors.neutral[200], true: colors.success[500] }}
          thumbColor={colors.neutral[0]}
        />
      )}

      {props.type === 'action' && props.actionLabel && (
        <Text
          className={cn(
            'text-base font-medium',
            actionColors[props.actionColor ?? 'primary']
          )}
        >
          {props.actionLabel}
        </Text>
      )}

      {props.type === 'info' && props.value && (
        <Text className="text-base text-neutral-400 dark:text-neutral-500">{props.value}</Text>
      )}
    </View>
  );

  if (props.type === 'navigate' || props.type === 'action') {
    return (
      <TouchableOpacity
        onPress={props.onPress}
        disabled={props.type === 'action' && props.loading}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}
