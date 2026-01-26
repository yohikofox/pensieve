import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Animated, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from '../utils';
import { colors, shadows } from '../tokens';

type ToastVariant = 'info' | 'success' | 'warning' | 'error';

interface ToastConfig {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  icon?: keyof typeof Feather.glyphMap;
}

interface ToastContextValue {
  show: (config: ToastConfig | string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, {
  container: string;
  text: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
}> = {
  info: {
    container: 'bg-neutral-800',
    text: 'text-white',
    icon: 'info',
    iconColor: colors.info[300],
  },
  success: {
    container: 'bg-neutral-800',
    text: 'text-white',
    icon: 'check-circle',
    iconColor: colors.success[400],
  },
  warning: {
    container: 'bg-neutral-800',
    text: 'text-white',
    icon: 'alert-triangle',
    iconColor: colors.warning[400],
  },
  error: {
    container: 'bg-neutral-800',
    text: 'text-white',
    icon: 'alert-circle',
    iconColor: colors.error[400],
  },
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  }, [opacity, translateY]);

  const showToast = useCallback((config: ToastConfig) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Reset animation values
    opacity.setValue(0);
    translateY.setValue(-20);

    // Set the toast
    setToast(config);

    // Animate in
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-hide after duration
    const duration = config.duration ?? 3000;
    timeoutRef.current = setTimeout(hideToast, duration);
  }, [opacity, translateY, hideToast]);

  const show = useCallback((config: ToastConfig | string) => {
    const toastConfig: ToastConfig = typeof config === 'string'
      ? { message: config, variant: 'info' }
      : config;
    showToast(toastConfig);
  }, [showToast]);

  const success = useCallback((message: string) => {
    showToast({ message, variant: 'success' });
  }, [showToast]);

  const error = useCallback((message: string) => {
    showToast({ message, variant: 'error' });
  }, [showToast]);

  const warning = useCallback((message: string) => {
    showToast({ message, variant: 'warning' });
  }, [showToast]);

  const info = useCallback((message: string) => {
    showToast({ message, variant: 'info' });
  }, [showToast]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const contextValue: ToastContextValue = {
    show,
    success,
    error,
    warning,
    info,
  };

  const variant = toast?.variant ?? 'info';
  const styles = variantStyles[variant];
  const iconName = toast?.icon ?? styles.icon;

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {toast && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: insets.top + 16,
              left: 16,
              right: 16,
              opacity,
              transform: [{ translateY }],
              zIndex: 9999,
            },
            Platform.select({
              ios: shadows.lg,
              android: { elevation: 8 },
            }),
          ]}
          pointerEvents="none"
        >
          <View
            className={cn(
              'flex-row items-center px-4 py-3 rounded-lg',
              styles.container
            )}
          >
            <Feather
              name={iconName}
              size={20}
              color={styles.iconColor}
            />
            <Text className={cn('flex-1 ml-3 text-base font-medium', styles.text)}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
