import React from 'react';
import { View } from 'react-native';
import { useSettingsStore } from '../../stores/settingsStore';

interface DebugClickTargetProps {
  x: number;
  y: number;
  color?: string;
  size?: number;
}

/**
 * Debug Click Target Visualizer
 *
 * Displays a colored dot at specified coordinates when debug mode is enabled.
 * Useful for debugging touch/click coordinates in UI testing.
 *
 * @param x - X coordinate (center of the dot)
 * @param y - Y coordinate (center of the dot)
 * @param color - Dot color (default: 'yellow')
 * @param size - Dot diameter in pixels (default: 10)
 */
export const DebugClickTarget: React.FC<DebugClickTargetProps> = ({
  x,
  y,
  color = 'yellow',
  size = 10,
}) => {
  const debugMode = useSettingsStore((state) => state.debugMode);

  if (!debugMode) {
    return null;
  }

  const radius = size / 2;

  return (
    <View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: radius,
        zIndex: 10000,
        transform: [{ translateX: -radius }, { translateY: -radius }],
      }}
    />
  );
};
