/**
 * SwipeNavigationHandler - Detects swipe gestures for navigation
 *
 * Story 3.2: Swipe left/right to navigate between captures
 *
 * Usage: Add this component at the root of CaptureDetailScreen:
 * <SwipeNavigationHandler captureId={captureId} onNavigate={(newId) => loadCapture(newId)} />
 */

import { useEffect } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useCapturesStore } from '../../stores/capturesStore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ReactNode } from 'react';
import { View } from 'react-native';

type CapturesStackParamList = {
  CapturesList: undefined;
  CaptureDetail: { captureId: string; startAnalysis?: boolean };
};

type NavigationProp = NativeStackNavigationProp<CapturesStackParamList, 'CaptureDetail'>;

interface SwipeNavigationHandlerProps {
  /** Current capture ID */
  captureId: string;
  /** Callback when navigation occurs */
  onNavigate: (newCaptureId: string) => void;
  /** Children to wrap with gesture detector */
  children: ReactNode;
  /** Enable/disable (default: true) */
  enabled?: boolean;
}

export function SwipeNavigationHandler({
  captureId,
  onNavigate,
  children,
  enabled = true,
}: SwipeNavigationHandlerProps) {
  const navigation = useNavigation<NavigationProp>();
  const captures = useCapturesStore((state) => state.captures);

  // Find current capture index
  const currentIndex = captures.findIndex((c) => c.id === captureId);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < captures.length - 1;

  // Swipe gesture (Story 3.2 AC)
  const panGesture = Gesture.Pan()
    .enabled(enabled && (hasPrevious || hasNext))
    .onEnd((event) => {
      const SWIPE_THRESHOLD = 100;
      const translation = event.translationX;
      const velocity = event.velocityX;

      // Swipe right → previous
      if (translation > SWIPE_THRESHOLD && velocity > 0 && hasPrevious) {
        const prevCapture = captures[currentIndex - 1];
        console.log('[SwipeNavigation] → Previous:', prevCapture.id);
        navigation.setParams({ captureId: prevCapture.id } as any);
        onNavigate(prevCapture.id);
      }

      // Swipe left → next
      if (translation < -SWIPE_THRESHOLD && velocity < 0 && hasNext) {
        const nextCapture = captures[currentIndex + 1];
        console.log('[SwipeNavigation] → Next:', nextCapture.id);
        navigation.setParams({ captureId: nextCapture.id } as any);
        onNavigate(nextCapture.id);
      }
    });

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <GestureDetector gesture={panGesture}>
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
}
