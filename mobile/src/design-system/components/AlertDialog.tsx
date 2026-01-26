import React from 'react';
import { View, Text, Modal, TouchableWithoutFeedback, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { cn } from '../utils';
import { colors, shadows } from '../tokens';
import { Button } from './Button';

type AlertDialogVariant = 'default' | 'danger' | 'warning';

interface AlertDialogAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

interface AlertDialogProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  icon?: keyof typeof Feather.glyphMap;
  variant?: AlertDialogVariant;
  /** Primary action (right side) */
  confirmAction?: AlertDialogAction;
  /** Secondary action (left side) - defaults to "Annuler" */
  cancelAction?: AlertDialogAction | boolean;
  /** Whether to close on backdrop press */
  dismissable?: boolean;
}

const variantConfig: Record<AlertDialogVariant, {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  iconBg: string;
}> = {
  default: {
    icon: 'info',
    iconColor: colors.primary[600],
    iconBg: 'bg-primary-100',
  },
  danger: {
    icon: 'alert-triangle',
    iconColor: colors.error[600],
    iconBg: 'bg-error-100',
  },
  warning: {
    icon: 'alert-circle',
    iconColor: colors.warning[600],
    iconBg: 'bg-warning-100',
  },
};

export function AlertDialog({
  visible,
  onClose,
  title,
  message,
  icon,
  variant = 'default',
  confirmAction,
  cancelAction = true,
  dismissable = true,
}: AlertDialogProps) {
  const config = variantConfig[variant];
  const iconName = icon ?? config.icon;

  const handleBackdropPress = () => {
    if (dismissable) {
      onClose();
    }
  };

  const handleCancel = () => {
    if (typeof cancelAction === 'object' && cancelAction.onPress) {
      cancelAction.onPress();
    } else {
      onClose();
    }
  };

  const handleConfirm = () => {
    if (confirmAction?.onPress) {
      confirmAction.onPress();
    }
  };

  // Determine button variants based on dialog variant
  const confirmVariant = confirmAction?.variant ?? (variant === 'danger' ? 'danger' : 'primary');
  const cancelLabel = typeof cancelAction === 'object' ? cancelAction.label : 'Annuler';
  const cancelVariant = typeof cancelAction === 'object' ? cancelAction.variant : 'ghost';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <TouchableWithoutFeedback>
            <View
              className="bg-white rounded-2xl w-full max-w-[320px] overflow-hidden"
              style={Platform.select({
                ios: shadows.xl,
                android: { elevation: 12 },
              })}
            >
              {/* Content */}
              <View className="px-6 pt-6 pb-4 items-center">
                {/* Icon */}
                <View
                  className={cn(
                    'w-14 h-14 rounded-full items-center justify-center mb-4',
                    config.iconBg
                  )}
                >
                  <Feather
                    name={iconName}
                    size={28}
                    color={config.iconColor}
                  />
                </View>

                {/* Title */}
                <Text className="text-lg font-semibold text-neutral-900 text-center mb-2">
                  {title}
                </Text>

                {/* Message */}
                {message && (
                  <Text className="text-base text-neutral-500 text-center leading-relaxed">
                    {message}
                  </Text>
                )}
              </View>

              {/* Actions - Stacked vertically for better touch targets */}
              <View className="px-6 pb-6 pt-2 gap-3">
                {confirmAction && (
                  <Button
                    variant={confirmVariant}
                    size="lg"
                    onPress={handleConfirm}
                    className="w-full h-14"
                  >
                    {confirmAction.label}
                  </Button>
                )}
                {cancelAction && (
                  <Button
                    variant="secondary"
                    size="lg"
                    onPress={handleCancel}
                    className="w-full h-14"
                  >
                    {cancelLabel}
                  </Button>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
