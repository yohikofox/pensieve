/**
 * withSwipeNavigation - HOC for swipe left/right navigation between captures
 *
 * Story 3.2: Enable horizontal swipe gestures to navigate between captures
 *
 * Features:
 * - Swipe left → next capture
 * - Swipe right → previous capture
 * - Only activates if multiple captures exist
 * - Smooth navigation with route params update
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useCapturesStore } from '../../stores/capturesStore';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type CapturesStackParamList = {
  CapturesList: undefined;
  CaptureDetail: { captureId: string; startAnalysis?: boolean };
};

type NavigationProp = NativeStackNavigationProp<CapturesStackParamList, 'CaptureDetail'>;

interface SwipeNavigationProps {
  /** Current capture ID from route params */
  captureId: string;
  /** Enable/disable swipe navigation (default: true) */
  enabled?: boolean;
}

/**
 * HOC that wraps a screen component with swipe navigation
 */
export function withSwipeNavigation<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return function SwipeNavigationWrapper(props: P & SwipeNavigationProps) {
    const { captureId, enabled = true, ...restProps } = props;
    const navigation = useNavigation<NavigationProp>();
    const captures = useCapturesStore((state) => state.captures);

    // Find current capture index
    const currentIndex = captures.findIndex((c) => c.id === captureId);
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex < captures.length - 1;

    // Swipe gesture handler (Story 3.2 AC)
    const panGesture = Gesture.Pan()
      .enabled(enabled && (hasPrevious || hasNext))
      .onEnd((event) => {
        const SWIPE_THRESHOLD = 100; // pixels
        const velocity = event.velocityX;
        const translation = event.translationX;

        // Swipe right → previous capture
        if (translation > SWIPE_THRESHOLD && velocity > 0 && hasPrevious) {
          const previousCapture = captures[currentIndex - 1];
          console.log('[SwipeNavigation] Navigating to previous capture:', previousCapture.id);
          navigation.setParams({ captureId: previousCapture.id });
        }

        // Swipe left → next capture
        if (translation < -SWIPE_THRESHOLD && velocity < 0 && hasNext) {
          const nextCapture = captures[currentIndex + 1];
          console.log('[SwipeNavigation] Navigating to next capture:', nextCapture.id);
          navigation.setParams({ captureId: nextCapture.id });
        }
      });

    if (!enabled) {
      return <WrappedComponent {...(restProps as P)} />;
    }

    return (
      <GestureDetector gesture={panGesture}>
        <View style={styles.container}>
          <WrappedComponent {...(restProps as P)} />
        </View>
      </GestureDetector>
    );
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
