/**
 * SavedIndicator Component
 *
 * Animated checkmark that appears when an item is saved
 */

import React, { useRef, useEffect } from "react";
import { Animated, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../design-system/tokens";
import { StatusIcons } from "../../design-system/icons";

interface SavedIndicatorProps {
  visible: boolean;
  onHidden: () => void;
}

export function SavedIndicator({ visible, onHidden }: SavedIndicatorProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      // Fade in + scale up
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();

      // Start fade out after 1.5s (total visible ~2s)
      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          // Reset scale for next time
          scale.setValue(0.8);
          onHidden();
        });
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [visible, opacity, scale, onHidden]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, { opacity, transform: [{ scale }] }]}
    >
      <Feather
        name={StatusIcons.success}
        size={18}
        color={colors.success[500]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 8,
    right: 8,
  },
});
