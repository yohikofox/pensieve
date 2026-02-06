/**
 * StandardLayout - Layout wrapper for standard screens
 *
 * Provides consistent theming and spacing for most app screens.
 * Automatically adapts background colors based on the active color scheme.
 *
 * Usage:
 * ```tsx
 * <StandardLayout>
 *   <YourScreenContent />
 * </StandardLayout>
 * ```
 */

import React, { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface StandardLayoutProps {
  /** Screen content */
  children: ReactNode;

  /** Use SafeAreaView wrapper (default: true) */
  useSafeArea?: boolean;

  /** Additional custom styles */
  style?: ViewStyle;

  /** Override default padding (default: no padding, use mx-4 mt-5 in children if needed) */
  noPadding?: boolean;
}

export function StandardLayout({
  children,
  useSafeArea = true,
  style,
  noPadding = true,
}: StandardLayoutProps) {
  const Wrapper = useSafeArea ? SafeAreaView : View;

  return (
    <Wrapper
      className="flex-1 bg-bg-screen"
      style={[
        !noPadding && { paddingHorizontal: 16, paddingTop: 20 },
        style,
      ]}
    >
      {children}
    </Wrapper>
  );
}
