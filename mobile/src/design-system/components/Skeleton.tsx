import { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { cn } from '../utils';

type SkeletonVariant = 'text' | 'circular' | 'rectangular';

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number | string;
  className?: string;
}

export function Skeleton({
  variant = 'rectangular',
  width,
  height,
  className,
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [opacity]);

  const variantStyles = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <Animated.View
      className={cn(
        'bg-neutral-200',
        variantStyles[variant],
        className
      )}
      style={[
        { opacity },
        width !== undefined && { width },
        height !== undefined && { height },
        variant === 'circular' && !width && !height && { width: 40, height: 40 },
      ]}
    />
  );
}

interface SkeletonGroupProps {
  count?: number;
  spacing?: number;
  children?: React.ReactNode;
}

export function SkeletonGroup({ count = 3, spacing = 12, children }: SkeletonGroupProps) {
  if (children) {
    return <View style={{ gap: spacing }}>{children}</View>;
  }

  return (
    <View style={{ gap: spacing }}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} height={16} />
      ))}
    </View>
  );
}
