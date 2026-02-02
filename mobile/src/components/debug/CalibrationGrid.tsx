/**
 * CalibrationGrid - Five-point calibration system
 *
 * Displays 5 reference points for screen calibration:
 * - Red: Top-left (0, 0)
 * - Green: Top-right (100%, 0)
 * - Blue: Bottom-left (0, 100%)
 * - Yellow: Bottom-right (100%, 100%)
 * - Magenta: Center (50%, 50%)
 *
 * Usage:
 * 1. Mount this component
 * 2. Take screenshot
 * 3. Detect colored points in screenshot
 * 4. Calculate coordinate transformation offsets
 */

import React from "react";
import { View, Dimensions, StyleSheet, Text } from "react-native";
import { CalibrationPoint } from "./CalibrationPoint";
import { DebugRect } from "./DebugRect";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface CalibrationGridProps {
  /** Show labels with coordinates (default: true) */
  showLabels?: boolean;
  /** Point size (default: 20) */
  pointSize?: number;
}

export function CalibrationGrid({
  showLabels = true,
  pointSize = 20,
}: CalibrationGridProps) {
  // Use 10% inset from edges to ensure points are visible (not hidden by screen edges or system bars)
  const inset = 0.1;
  const points = [
    {
      id: "origin",
      x: 0,
      y: 0,
      color: "#FFFFFF",
      label: `O (0,0)`,
    },
    {
      id: "top-left",
      x: screenWidth * inset,
      y: screenHeight * inset,
      color: "#FF0000",
      label: `TL (${Math.round(screenWidth * inset)},${Math.round(screenHeight * inset)})`,
    },
    {
      id: "top-right",
      x: screenWidth * (1 - inset),
      y: screenHeight * inset,
      color: "#00FF00",
      label: `TR (${Math.round(screenWidth * (1 - inset))},${Math.round(screenHeight * inset)})`,
    },
    {
      id: "bottom-left",
      x: screenWidth * inset,
      y: screenHeight * (1 - inset),
      color: "#0000FF",
      label: `BL (${Math.round(screenWidth * inset)},${Math.round(screenHeight * (1 - inset))})`,
    },
    {
      id: "bottom-right",
      x: screenWidth * (1 - inset),
      y: screenHeight * (1 - inset),
      color: "#FFFF00",
      label: `BR (${Math.round(screenWidth * (1 - inset))},${Math.round(screenHeight * (1 - inset))})`,
    },
    {
      id: "center",
      x: screenWidth / 2,
      y: screenHeight / 2,
      color: "#FF00FF",
      label: `C (${Math.round(screenWidth / 2)},${Math.round(screenHeight / 2)})`,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Calibration info */}
      {showLabels && (
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Calibration Grid Active</Text>
          <Text style={styles.infoText}>
            Screen: {screenWidth}x{screenHeight}
          </Text>
          <Text style={styles.infoText}>
            Points: 6 (including Origin at 0,0)
          </Text>
        </View>
      )}

      {/* Calibration points */}
      {points.map((point) => (
        <CalibrationPoint
          key={point.id}
          x={point.x}
          y={point.y}
          color={point.color}
          size={pointSize}
        />
      ))}

      {/* Labels */}
      {showLabels &&
        points.map((point) => (
          <View
            key={`label-${point.id}`}
            style={[
              styles.label,
              {
                left: point.x + (point.id.includes("right") ? -100 : 10),
                top: point.y + (point.id.includes("bottom") ? -30 : 10),
              },
            ]}
          >
            <Text style={styles.labelText}>{point.label}</Text>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
    pointerEvents: "none",
  },
  infoBox: {
    position: "absolute",
    bottom: 180,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 12,
    borderRadius: 8,
    zIndex: 10000,
  },
  infoTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  infoText: {
    color: "#CCCCCC",
    fontSize: 12,
    marginBottom: 4,
  },
  label: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 4,
    borderRadius: 4,
    zIndex: 10000,
  },
  labelText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "monospace",
  },
});
