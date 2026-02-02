/**
 * VisualCalibrationMarker - Marqueur visuel pour calibration par screenshot
 *
 * Ce composant entoure un élément avec un cadre contrasté détectable
 * visuellement dans un screenshot. Utilisé quand mobile_list_elements_on_screen
 * échoue (ex: modals transparents).
 *
 * Le marqueur affiche:
 * - Un cadre contrasté (magenta par défaut) avec coins marqués
 * - Un label unique pour identification
 * - Des coins distinctifs pour détection précise des bounds
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useSettingsStore } from '../../stores/settingsStore';

interface VisualCalibrationMarkerProps {
  /** Unique identifier for this marker (used in calibration) */
  id: string;
  /** Children to wrap */
  children: React.ReactNode;
  /** Marker color (default: magenta for high contrast) */
  color?: string;
  /** Show label above marker */
  showLabel?: boolean;
  /** Additional style for the wrapper */
  style?: ViewStyle;
  /** Corner marker size */
  cornerSize?: number;
}

/**
 * Wraps an element with a visual calibration marker.
 *
 * Usage:
 * ```tsx
 * <VisualCalibrationMarker id="stop_button">
 *   <TouchableOpacity onPress={onStop}>
 *     <Text>Stop</Text>
 *   </TouchableOpacity>
 * </VisualCalibrationMarker>
 * ```
 *
 * When screenshot is taken, Claude can detect the marker bounds
 * and calculate the center coordinates for clicking.
 */
export function VisualCalibrationMarker({
  id,
  children,
  color = '#FF00FF', // Magenta - high contrast on most backgrounds
  showLabel = true,
  style,
  cornerSize = 8,
}: VisualCalibrationMarkerProps) {
  const debugMode = useSettingsStore((state) => state.debugMode);

  // Only show markers in debug mode
  if (!debugMode) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.wrapper, style]}>
      {/* The actual element */}
      {children}

      {/* Calibration overlay - pointerEvents none so it doesn't block touches */}
      <View style={styles.overlay} pointerEvents="none">
        {/* Border frame */}
        <View style={[styles.frame, { borderColor: color }]} />

        {/* Corner markers for precise detection */}
        <View style={[styles.cornerTL, { backgroundColor: color, width: cornerSize, height: cornerSize }]} />
        <View style={[styles.cornerTR, { backgroundColor: color, width: cornerSize, height: cornerSize }]} />
        <View style={[styles.cornerBL, { backgroundColor: color, width: cornerSize, height: cornerSize }]} />
        <View style={[styles.cornerBR, { backgroundColor: color, width: cornerSize, height: cornerSize }]} />

        {/* Center crosshair */}
        <View style={styles.centerContainer}>
          <View style={[styles.centerDot, { backgroundColor: color }]} />
        </View>

        {/* Label */}
        {showLabel && (
          <View style={[styles.labelContainer, { backgroundColor: color }]}>
            <Text style={styles.labelText}>CAL:{id}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Standalone marker that can be positioned absolutely on screen.
 * Use this when you can't wrap the element.
 */
interface StandaloneMarkerProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export function VisualCalibrationMarkerStandalone({
  id,
  x,
  y,
  width,
  height,
  color = '#FF00FF',
}: StandaloneMarkerProps) {
  const debugMode = useSettingsStore((state) => state.debugMode);

  if (!debugMode) {
    return null;
  }

  const cornerSize = 8;

  return (
    <View
      style={[
        styles.standaloneWrapper,
        { left: x, top: y, width, height },
      ]}
      pointerEvents="none"
    >
      {/* Border frame */}
      <View style={[styles.frame, { borderColor: color }]} />

      {/* Corner markers */}
      <View style={[styles.cornerTL, { backgroundColor: color, width: cornerSize, height: cornerSize }]} />
      <View style={[styles.cornerTR, { backgroundColor: color, width: cornerSize, height: cornerSize }]} />
      <View style={[styles.cornerBL, { backgroundColor: color, width: cornerSize, height: cornerSize }]} />
      <View style={[styles.cornerBR, { backgroundColor: color, width: cornerSize, height: cornerSize }]} />

      {/* Center crosshair */}
      <View style={styles.centerContainer}>
        <View style={[styles.centerDot, { backgroundColor: color }]} />
      </View>

      {/* Label */}
      <View style={[styles.labelContainer, { backgroundColor: color }]}>
        <Text style={styles.labelText}>CAL:{id}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  standaloneWrapper: {
    position: 'absolute',
    zIndex: 10000,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderStyle: 'solid',
  },
  // Corner markers for precise bound detection
  cornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
  },
  cornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
  },
  cornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
  },
  cornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  // Center marker
  centerContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Label
  labelContainer: {
    position: 'absolute',
    top: -20,
    left: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
  },
  labelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
});
