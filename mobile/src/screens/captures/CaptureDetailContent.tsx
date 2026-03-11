/**
 * CaptureDetailContent - Main content component for capture detail view
 *
 * Structure UX :
 * - CaptureHeader (compact, 1 ligne)
 * - CaptureAudioPlayerSection (sticky sous le header)
 * - CaptureDetailTabs (Analyse par défaut / Transcription)
 * - ActionBar (fixe en bas)
 * - DeleteCaptureDialog
 * - Modal ⋮ : sections satellites (métadonnées, transcription brute, debug)
 *
 * This is the content component in the Wrapper + Content pattern.
 * The wrapper (CaptureDetailScreen) handles route params extraction.
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
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useCaptureDetailInit } from "../../hooks/useCaptureDetailInit";
import { StandardLayout } from "../../components/layouts";
import { useNavigation } from "@react-navigation/native";
import { useCaptureDetailListener } from "../../hooks/useCaptureDetailListener";
import {
  ReprocessingCard,
  NativeRecognitionDebugCard,
  CaptureHeader,
  MetadataSection,
  RawTranscriptSection,
  ActionBar,
  CaptureDetailLoading,
  CaptureDetailError,
  CaptureAudioPlayerSection,
  DeleteCaptureDialog,
  CaptureDetailTabs,
} from "../../components/capture";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";
import { colors } from "../../design-system/tokens";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";

export interface CaptureDetailContentProps {
  captureId: string;
  startAnalysis?: boolean;
  highlightIdeaId?: string;
  highlightTodoId?: string;
}

export function CaptureDetailContent({
  captureId,
  startAnalysis,
  highlightIdeaId,
  highlightTodoId,
}: CaptureDetailContentProps) {
  const navigation = useNavigation();
  const [showSatelliteModal, setShowSatelliteModal] = useState(false);
  const { themeColors, isDark } = useCaptureTheme();

  // Zustand store for capture detail state
  const loading = useCaptureDetailStore((state) => state.loading);

  // Initialization hook - autonomous, reads and writes to stores
  useCaptureDetailInit(captureId);

  // Event-driven updates - autonomous, reads from store
  useCaptureDetailListener();

  const openSatelliteModal = useCallback(() => {
    setShowSatelliteModal(true);
  }, []);

  // Ajoute le bouton ⋮ dans le header de navigation
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

  if (loading) {
    return <CaptureDetailLoading />;
  }

  return (
    <CaptureDetailError onGoBack={() => navigation.goBack()}>
      <StandardLayout>
        <View style={styles.container}>
          {/* Header compact */}
          <CaptureHeader />

          {/* Player audio sticky sous le header */}
          <CaptureAudioPlayerSection />

          {/* Tabs : Analyse (défaut) / Transcription */}
          <CaptureDetailTabs
            startAnalysis={startAnalysis}
            highlightIdeaId={highlightIdeaId}
            highlightTodoId={highlightTodoId}
          />

          {/* Action Bar fixe */}
          <ActionBar />

          {/* Delete confirmation dialog - Autonomous */}
          <DeleteCaptureDialog />
        </View>
      </StandardLayout>

      {/* Modal satellite : métadonnées, transcription brute, reprocessing, debug */}
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
          {/* Modal Header */}
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

          {/* Modal Content */}
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
