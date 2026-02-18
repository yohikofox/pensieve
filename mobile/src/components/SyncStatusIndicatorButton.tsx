/**
 * SyncStatusIndicatorButton - Tappable sync status header button
 *
 * Story 6.4 - Task 2: Add sync status indicator to app header
 *
 * Wraps SyncStatusIndicator in a TouchableOpacity.
 * Tapping opens SyncStatusDetailModal.
 *
 * Usage: Add to MainNavigator screenOptions.headerRight
 *
 * @architecture Layer: UI Component (header button)
 */

import React from 'react';
import { TouchableOpacity } from 'react-native';
import { SyncStatusIndicator } from './SyncStatusIndicator';

export interface SyncStatusIndicatorButtonProps {
  onPress: () => void;
}

/**
 * SyncStatusIndicatorButton Component
 *
 * Renders a compact sync status badge in the header.
 * Tapping it opens the detail modal.
 */
export const SyncStatusIndicatorButton: React.FC<SyncStatusIndicatorButtonProps> = ({
  onPress,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Statut de synchronisation"
      style={{ marginRight: 8 }}
    >
      <SyncStatusIndicator compact />
    </TouchableOpacity>
  );
};

export default SyncStatusIndicatorButton;
