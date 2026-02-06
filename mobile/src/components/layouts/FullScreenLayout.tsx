/**
 * FullScreenLayout - Layout wrapper for fullscreen screens
 *
 * Provides fullscreen layout without padding, ideal for immersive screens
 * like capture/record, media viewers, or onboarding.
 * Automatically adapts background colors based on the active color scheme.
 *
 * Usage:
 * ```tsx
 * <FullScreenLayout>
 *   <RecordingScreen />
 * </FullScreenLayout>
 * ```
 */

import React, { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface FullScreenLayoutProps {
  /** Screen content */
  children: ReactNode;

  /** Use SafeAreaView wrapper (default: false for true fullscreen) */
  useSafeArea?: boolean;

  /** Additional custom styles */
  style?: ViewStyle;

  /** Background color override (default: uses theme bg-screen) */
  backgroundColor?: 'screen' | 'card' | 'transparent';
}

export function FullScreenLayout({
  children,
  useSafeArea = false,
  style,
  backgroundColor = 'screen',
}: FullScreenLayoutProps) {
  const Wrapper = useSafeArea ? SafeAreaView : View;

  const bgClass = backgroundColor === 'transparent'
    ? 'bg-transparent'
    : backgroundColor === 'card'
    ? 'bg-bg-card'
    : 'bg-bg-screen';

  return (
    <Wrapper
      className={`flex-1 ${bgClass}`}
      style={style}
    >
      {children}
    </Wrapper>
  );
}
