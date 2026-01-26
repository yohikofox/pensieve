import { View, Text, Modal, type ModalProps, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { cn } from '../utils';
import { colors, shadows } from '../tokens';

interface ModalContainerProps extends Omit<ModalProps, 'children'> {
  title?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
  position?: 'center' | 'bottom';
  className?: string;
}

const sizeStyles = {
  sm: 'w-4/5 max-w-[300px]',
  md: 'w-4/5 max-w-[400px]',
  lg: 'w-11/12 max-w-[500px]',
  full: 'w-full h-full',
};

export function ModalContainer({
  title,
  showCloseButton = true,
  onClose,
  children,
  size = 'md',
  position = 'center',
  className,
  ...modalProps
}: ModalContainerProps) {
  const handleBackdropPress = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <Modal
      transparent={position !== 'bottom' || size !== 'full'}
      animationType={position === 'bottom' ? 'slide' : 'fade'}
      onRequestClose={onClose}
      {...modalProps}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View
          className={cn(
            'flex-1',
            position === 'center' && 'bg-black/50 justify-center items-center',
            position === 'bottom' && 'bg-black/50 justify-end'
          )}
        >
          <TouchableWithoutFeedback>
            <View
              className={cn(
                'bg-white',
                position === 'center' && 'rounded-xl',
                position === 'bottom' && 'rounded-t-xl',
                size !== 'full' && sizeStyles[size],
                className
              )}
              style={shadows.lg}
            >
              {(title || showCloseButton) && (
                <View className="flex-row items-center justify-between px-4 py-3 border-b border-neutral-100">
                  {title ? (
                    <Text className="text-lg font-semibold text-neutral-900">
                      {title}
                    </Text>
                  ) : (
                    <View />
                  )}
                  {showCloseButton && onClose && (
                    <TouchableOpacity
                      onPress={onClose}
                      className="w-8 h-8 items-center justify-center rounded-full active:bg-neutral-100"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Feather name="x" size={20} color={colors.neutral[500]} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <View className="p-4">{children}</View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
