import React from "react";
import { DebugClickTarget } from "./DebugClickTarget";

/**
 * Screen Calibration Origin Marker
 *
 * Places an invisible calibration point at the screen's origin (0,0) for
 * the mobile-test framework to detect and calibrate screen-specific coordinates.
 *
 * Usage: Add this component to any screen you want to calibrate:
 *
 * ```tsx
 * import { ScreenCalibrationOrigin } from '@/components/debug';
 *
 * export const MyScreen = () => (
 *   <View>
 *     <ScreenCalibrationOrigin />
 *     {/* rest of screen *\/}
 *   </View>
 * );
 * ```
 *
 * Then run: /mobile-test calibrate-screen <screen-name>
 *
 * The marker is only visible when debug mode is enabled in settings.
 * It uses a small white dot that blends with most backgrounds.
 */
export const ScreenCalibrationOrigin: React.FC = () => {
  return (
    <DebugClickTarget
      x={20}
      y={20}
      physical={false}
      color="#FFFFFF"
      size={20}
      label="ORIGIN_0_0"
      borderColor="#FF0000"
    />
  );
};
