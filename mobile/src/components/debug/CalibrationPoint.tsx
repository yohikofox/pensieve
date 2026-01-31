/**
 * CalibrationPoint - Single calibration marker
 *
 * Displays a colored point at specific coordinates for screen calibration.
 * Used by CalibrationGrid to establish coordinate system reference points.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

interface CalibrationPointProps {
  /** X coordinate in pixels */
  x: number;
  /** Y coordinate in pixels */
  y: number;
  /** Point color (hex or named color) */
  color: string;
  /** Point size in pixels (default: 20) */
  size?: number;
}

export function CalibrationPoint({ x, y, color, size = 20 }: CalibrationPointProps) {
  return (
    <View
      style={[
        styles.point,
        {
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: size / 2,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  point: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 9999,
  },
});
