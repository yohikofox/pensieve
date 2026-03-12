/**
 * CaptureTextDetailTest
 *
 * Composant de test autonome — valide le pattern KeyboardAwareScrollView +
 * KeyboardStickyView (siblings dans un View) avant intégration définitive.
 * Inspiré de AwareScrollViewStickyFooter dans le repo react-native-keyboard-controller.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  LayoutChangeEvent,
} from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";
import { useTextEditor } from "../../hooks/useTextEditor";

export function CaptureTextDetailTest() {
  const tabBarHeight = useBottomTabBarHeight();
  const [footerHeight, setFooterHeight] = useState(0);
  const scrollViewRef = useRef<KeyboardAwareScrollView>(null);
  const textInputRef = useRef<TextInput>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined);

  useEffect(() => {
    if (isEditingText) {
      // 1. Positionner le curseur en début de texte
      setSelection({ start: 0, end: 0 });
      // 2. Donner le focus après que React ait rendu avec selection={0,0}
      const focusTimeout = setTimeout(() => {
        textInputRef.current?.focus();
        // 3. Libérer le contrôle de la sélection après le focus
        const releaseTimeout = setTimeout(() => setSelection(undefined), 150);
        return () => clearTimeout(releaseTimeout);
      }, 50);
      return () => clearTimeout(focusTimeout);
    }
  }, [isEditingText]);

  const isEditingText = useCaptureDetailStore((state) => state.isEditingText);
  const setIsEditingText = useCaptureDetailStore(
    (state) => state.setIsEditingText,
  );
  const { editedText, handleTextChange, handleSave, handleDiscardChanges } =
    useTextEditor();

  const handleFooterLayout = useCallback((e: LayoutChangeEvent) => {
    setFooterHeight(e.nativeEvent.layout.height);
  }, []);

  const handleSaveAndExit = async () => {
    await handleSave();
    setIsEditingText(false);
  };

  const handleCancel = () => {
    handleDiscardChanges();
    setIsEditingText(false);
  };

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        bottomOffset={footerHeight + 50}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {isEditingText ? (
          <TextInput
            ref={textInputRef}
            style={styles.textInput}
            value={editedText}
            onChangeText={handleTextChange}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            placeholder="Saisissez votre texte..."
            selection={selection}
          />
        ) : (
          <Text style={styles.readText}>{editedText || "Aucun contenu"}</Text>
        )}
      </KeyboardAwareScrollView>

      <Text
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          color: "red",
          fontSize: 10,
        }}
      >
        tabBarHeight={tabBarHeight}
      </Text>

      <KeyboardStickyView offset={{ closed: 0, opened: tabBarHeight }}>
        <View style={styles.footer} onLayout={handleFooterLayout}>
          {isEditingText ? (
            <>
              <TouchableOpacity
                style={styles.button}
                onPress={handleCancel}
              >
                <Text>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSaveAndExit}
              >
                <Text style={styles.saveLabel}>Enregistrer</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.button}
              onPress={() => setIsEditingText(true)}
            >
              <Text>Modifier</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  content: {
    padding: 16,
  },
  readText: {
    fontSize: 16,
    lineHeight: 24,
  },
  textInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 150,
    borderWidth: 1,
    borderColor: "#007AFF",
    borderRadius: 8,
    padding: 12,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  button: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#f2f2f7",
  },
  saveButton: {
    backgroundColor: "#34C759",
  },
  saveLabel: {
    color: "#fff",
    fontWeight: "600",
  },
});
