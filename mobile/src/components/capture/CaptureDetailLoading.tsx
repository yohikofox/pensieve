/**
 * CaptureDetailLoading
 *
 * Loading state component for CaptureDetailScreen.
 * Displays a centered loading spinner while the capture is being loaded.
 *
 * Extracted from CaptureDetailScreen.tsx to improve organization.
 */

import React from "react";
import { View, ActivityIndicator } from "react-native";
import { colors } from "../../design-system/tokens";
import { StandardLayout } from "../layouts";
import { styles } from "../../styles/CaptureDetailScreen.styles";

export function CaptureDetailLoading() {
  return (
    <StandardLayout>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    </StandardLayout>
  );
}
