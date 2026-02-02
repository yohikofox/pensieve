/**
 * CalibrationPoint - Single calibration marker
 *
 * Displays a colored point with crosshair at specific coordinates for screen calibration.
 * Used by CalibrationGrid to establish coordinate system reference points.
 * Now uses DebugClickTarget for consistent visualization with crosshair and center dot.
 */

import React from 'react';
import { DebugClickTarget } from './DebugClickTarget';

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
    <DebugClickTarget
      x={x}
      y={y}
      color={color}
      size={size}
      physical={false}
      borderColor="#FFFFFF"
    />
  );
}
