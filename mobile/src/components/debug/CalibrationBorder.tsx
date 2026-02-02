import React from "react";
import { View, ViewStyle, StyleProp } from "react-native";
import { useSettingsStore } from "../../stores/settingsStore";

interface CalibrationBorderProps {
  /**
   * Content to wrap with the calibration border
   */
  children: React.ReactNode;

  /**
   * Border width in pixels
   * @default 2
   */
  borderWidth?: number;

  /**
   * Border color
   * @default "#00FFFF" (cyan)
   */
  borderColor?: string;

  /**
   * Border style
   * @default "dashed"
   */
  borderStyle?: "solid" | "dashed" | "dotted";

  /**
   * Additional style for the wrapper
   */
  style?: StyleProp<ViewStyle>;
}

/**
 * Calibration Border Component
 *
 * Wraps any component with a visible border for calibration and debugging purposes.
 * The border is only rendered when both debug mode and calibration grid settings are enabled.
 * Useful for identifying touch targets and component boundaries during development.
 *
 * @example
 * ```tsx
 * <CalibrationBorder>
 *   <TouchableOpacity onPress={handlePress}>
 *     <Text>Button</Text>
 *   </TouchableOpacity>
 * </CalibrationBorder>
 * ```
 */
export const CalibrationBorder: React.FC<CalibrationBorderProps> = ({
  children,
  borderWidth = 2,
  borderColor = "#00FFFF",
  borderStyle = "dashed",
  style,
}) => {
  const debugMode = useSettingsStore((state) => state.debugMode);
  const showCalibrationGrid = useSettingsStore((state) => state.showCalibrationGrid);

  // Only render the border when both debug mode and calibration grid are enabled
  if (!debugMode || !showCalibrationGrid) {
    return <>{children}</>;
  }

  return (
    <View
      style={[
        {
          borderWidth,
          borderColor,
          borderStyle,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};
