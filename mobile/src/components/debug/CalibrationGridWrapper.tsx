/**
 * CalibrationGridWrapper - Conditional wrapper for CalibrationGrid
 *
 * Displays CalibrationGrid only when ALL three conditions are met:
 * 1. __DEV__ - React Native development mode
 * 2. debugMode - User has enabled debug features in settings
 * 3. showCalibrationGrid - User has NOT explicitly disabled the grid
 *
 * This allows granular control over grid visibility without adding
 * conditional logic in every screen that uses it.
 */

import React from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { CalibrationGrid } from './CalibrationGrid';

export function CalibrationGridWrapper() {
  const debugMode = useSettingsStore((state) => state.debugMode);
  const showCalibrationGrid = useSettingsStore((state) => state.showCalibrationGrid);

  // Grid is visible only when:
  // - App is in development mode (__DEV__)
  // - Debug mode is enabled in settings (debugMode)
  // - Grid visibility is not explicitly disabled (showCalibrationGrid)
  const shouldShowGrid = __DEV__ && debugMode && showCalibrationGrid;

  console.log('[CalibrationGridWrapper]', {
    __DEV__,
    debugMode,
    showCalibrationGrid,
    shouldShowGrid,
  });

  if (!shouldShowGrid) {
    return null;
  }

  return <CalibrationGrid />;
}
