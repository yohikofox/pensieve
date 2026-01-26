import { View, Text, ActivityIndicator } from 'react-native';
import { cn } from '../utils';
import { colors } from '../tokens';

type LoadingSize = 'small' | 'large';

interface LoadingViewProps {
  message?: string;
  size?: LoadingSize;
  fullScreen?: boolean;
  className?: string;
}

export function LoadingView({
  message,
  size = 'large',
  fullScreen = false,
  className,
}: LoadingViewProps) {
  return (
    <View
      className={cn(
        'items-center justify-center',
        fullScreen ? 'flex-1 bg-bg-screen' : 'py-8',
        className
      )}
    >
      <ActivityIndicator size={size} color={colors.primary[500]} />
      {message && (
        <Text className="mt-4 text-base text-text-secondary text-center">
          {message}
        </Text>
      )}
    </View>
  );
}
