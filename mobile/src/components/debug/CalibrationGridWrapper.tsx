/**
 * CalibrationGridWrapper - Conditional wrapper for CalibrationGrid
 *
 * Displays CalibrationGrid only when ALL conditions are met:
 * 1. __DEV__ - React Native development mode
 * 2. debugMode + debugModeAccess - Debug mode fully enabled (permission AND toggle)
 * 3. showCalibrationGrid - User has NOT explicitly disabled the grid
 *
 * Story 7.1: Debug mode requires BOTH backend permission AND user toggle.
 */

import React from 'react';
import { useSettingsStore, selectIsDebugModeEnabled } from '../../stores/settingsStore';
import { CalibrationGrid } from './CalibrationGrid';

export function CalibrationGridWrapper() {
  const isDebugEnabled = useSettingsStore(selectIsDebugModeEnabled);
  const showCalibrationGrid = useSettingsStore((state) => state.showCalibrationGrid);

  // Grid is visible only when:
  // - App is in development mode (__DEV__)
  // - Debug mode is FULLY enabled (permission + toggle via centralized selector)
  // - Grid visibility is not explicitly disabled (showCalibrationGrid)
  const shouldShowGrid = __DEV__ && isDebugEnabled && showCalibrationGrid;

  console.log('[CalibrationGridWrapper]', {
    __DEV__,
    debugMode: isDebugEnabled,
    showCalibrationGrid,
    shouldShowGrid,
  });

  if (!shouldShowGrid) {
    return null;
  }

  return <CalibrationGrid />;
}
