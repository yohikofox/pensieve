import React from "react";
import { Dimensions, PixelRatio, View } from "react-native";
import { useSettingsStore } from "../../stores/settingsStore";

interface DebugClickTargetProps {
  x: number;
  y: number;
  color?: string;
  size?: number;
  physical?: boolean; // If true, x/y are in physical pixels and will be converted to logical
  label?: string; // Accessibility label for MCP detection
  borderColor?: string; // Border color for the center dot (default: 'white')
}

/**
 * Debug Click Target Visualizer
 *
 * Displays a crosshair (mire) with a centered dot to show calibration points.
 * The crosshair and dot both represent the actual coordinate (x,y).
 * Only rendered when both debug mode and calibration grid settings are enabled.
 * Useful for debugging touch/click coordinates in UI testing.
 *
 * @param x - X coordinate (center of the crosshair and dot)
 * @param y - Y coordinate (center of the crosshair and dot)
 * @param color - Color for the crosshair and dot (default: 'yellow')
 * @param size - Dot diameter in pixels (default: 10)
 * @param physical - If true, x/y are physical device pixels (will be converted to logical pixels)
 * @param label - Accessibility label for MCP detection
 * @param borderColor - Border color for the center dot (default: 'white')
 */
export const DebugClickTarget: React.FC<DebugClickTargetProps> = ({
  x,
  y,
  color = "yellow",
  size = 10,
  physical = false,
  label,
  borderColor = "white",
}) => {
  const debugMode = useSettingsStore((state) => state.debugMode);
  const showCalibrationGrid = useSettingsStore(
    (state) => state.showCalibrationGrid,
  );

  if (!debugMode || !showCalibrationGrid) {
    return null;
  }

  // Convert physical pixels to logical pixels if needed
  const pixelRatio = PixelRatio.get();
  const logicalX = physical ? x / pixelRatio : x;
  const logicalY = physical ? y / pixelRatio : y;

  const radius = size / 2;
  const crossSize = size * 2;
  const crossThickness = 2;

  return (
    <View
      accessible={!!label}
      accessibilityLabel={label}
      style={{
        position: "absolute",
        left: logicalX,
        top: logicalY,
        zIndex: 10000,
      }}
    >
      {/* Crosshair (mire) centered at the actual coordinate */}
      <View
        style={{
          position: "absolute",
          width: crossSize,
          height: crossSize,
          left: -crossSize / 2,
          top: -crossSize / 2,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Horizontal line */}
        <View
          style={{
            position: "absolute",
            width: crossSize,
            height: crossThickness,
            backgroundColor: "lightgray",
            opacity: 0.6,
          }}
        />
        {/* Vertical line */}
        <View
          style={{
            position: "absolute",
            width: crossThickness,
            height: crossSize,
            backgroundColor: "lightgray",
            opacity: 0.6,
          }}
        />
      </View>

      {/* Center dot */}
      <View
        style={{
          position: "absolute",
          left: -radius,
          top: -radius,
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: radius,
          borderWidth: borderColor ? 2 : 0,
          borderColor: borderColor,
        }}
      />
    </View>
  );
};
