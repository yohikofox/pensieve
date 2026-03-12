/**
 * CaptureDetailShell
 *
 * Chrome partagé entre CaptureAudioDetailContent et CaptureTextDetailContent :
 * - Navigation ⋮ (bouton satellite)
 * - StandardLayout > CaptureHeader > {children} > KeyboardStickyView(ActionBar)
 * - DeleteCaptureDialog
 * - Modal satellite (métadonnées, transcription brute, reprocessing, debug)
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Modal,
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
} from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { StandardLayout } from "../layouts";
import { colors } from "../../design-system/tokens";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";
import { CaptureHeader } from "./CaptureHeader";
import { ActionBar } from "./ActionBar";
import { DeleteCaptureDialog } from "./DeleteCaptureDialog";
import { CaptureDetailError } from "./CaptureDetailError";
import { MetadataSection } from "./MetadataSection";
import { RawTranscriptSection } from "./RawTranscriptSection";
import { ReprocessingCard } from "./ReprocessingCard";
import { NativeRecognitionDebugCard } from "./NativeRecognitionDebugCard";

interface CaptureDetailShellProps {
  children: React.ReactNode;
}

export function CaptureDetailShell({ children }: CaptureDetailShellProps) {
  const navigation = useNavigation();
  const tabBarHeight = useBottomTabBarHeight();
  const [showSatelliteModal, setShowSatelliteModal] = useState(false);
  const { themeColors, isDark } = useCaptureTheme();

  const openSatelliteModal = useCallback(() => {
    setShowSatelliteModal(true);
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={openSatelliteModal}
          style={styles.menuButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Plus d'options"
          accessibilityRole="button"
        >
          <Feather
            name="more-vertical"
            size={22}
            color={isDark ? colors.neutral[100] : colors.neutral[700]}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, openSatelliteModal, isDark]);

  return (
    <CaptureDetailError onGoBack={() => navigation.goBack()}>
      <StandardLayout>
        <View style={styles.container}>
          <CaptureHeader />

          {children}

          <KeyboardStickyView offset={{ closed: 0, opened: tabBarHeight }}>
            <ActionBar />
          </KeyboardStickyView>

          <DeleteCaptureDialog />
        </View>
      </StandardLayout>

      <Modal
        visible={showSatelliteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSatelliteModal(false)}
      >
        <SafeAreaView
          style={[
            styles.modalContainer,
            { backgroundColor: themeColors.screenBg },
          ]}
        >
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: themeColors.borderDefault },
            ]}
          >
            <Text
              style={[styles.modalTitle, { color: themeColors.textPrimary }]}
            >
              Détails techniques
            </Text>
            <TouchableOpacity
              onPress={() => setShowSatelliteModal(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather
                name="x"
                size={22}
                color={isDark ? colors.neutral[300] : colors.neutral[600]}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
          >
            <MetadataSection />
            <View style={styles.modalSeparator} />
            <RawTranscriptSection />
            <View style={styles.modalSeparator} />
            <ReprocessingCard />
            <View style={styles.modalSeparator} />
            <NativeRecognitionDebugCard />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </CaptureDetailError>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  menuButton: {
    padding: 4,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    gap: 16,
  },
  modalSeparator: {
    height: 8,
  },
});
