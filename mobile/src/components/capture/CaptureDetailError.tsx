/**
 * CaptureDetailError
 *
 * Error state component for CaptureDetailScreen.
 * Displays an error message when the capture cannot be found or loaded.
 *
 * Extracted from CaptureDetailScreen.tsx to improve organization.
 */

import React, { PropsWithChildren } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { StandardLayout } from "../layouts";
import { StatusIcons } from "../../design-system/icons";
import { styles } from "../../styles/CaptureDetailScreen.styles";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";

export interface CaptureDetailErrorProps {
  onGoBack: () => void;
}

export function CaptureDetailError({
  onGoBack,
  children,
}: PropsWithChildren<CaptureDetailErrorProps>) {
  const capture = useCaptureDetailStore((state) => state.capture);
  const { themeColors } = useCaptureTheme();

  if (capture) return <>{children}</>; // Only show error if capture is not found

  return (
    <StandardLayout>
      <View style={styles.errorContainer}>
        <Feather
          name={StatusIcons.error}
          size={48}
          color={themeColors.textTertiary}
        />
        <Text style={[styles.errorText, { color: themeColors.textMuted }]}>
          Capture introuvable
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    </StandardLayout>
  );
}
