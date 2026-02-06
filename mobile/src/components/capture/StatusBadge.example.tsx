/**
 * StatusBadge - Example Component Using Theme HOC Pattern
 *
 * This is a demonstration of the theme injection pattern using HOC.
 * Shows the difference between old and new approaches.
 *
 * Story 5.4 - Theme Pattern Standardization
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../design-system/tokens";
import { withCaptureTheme, type WithCaptureThemeProps } from "../../hoc";

// ============================================================================
// OLD APPROACH (Prop Drilling) - DON'T USE
// ============================================================================

interface StatusBadgeOldProps {
  status: "success" | "error" | "pending";
  themeColors: {
    successBg: string;
    errorBg: string;
    pendingBg: string;
    textPrimary: string;
  };
  isDark: boolean;
}

/**
 * @deprecated Use StatusBadge instead (new HOC pattern)
 */
export function StatusBadgeOld({
  status,
  themeColors,
  isDark,
}: StatusBadgeOldProps) {
  const bgColor =
    status === "success"
      ? themeColors.successBg
      : status === "error"
        ? themeColors.errorBg
        : themeColors.pendingBg;

  const icon =
    status === "success"
      ? "check-circle"
      : status === "error"
        ? "x-circle"
        : "clock";

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Feather
        name={icon}
        size={14}
        color={isDark ? colors.neutral[100] : colors.neutral[900]}
      />
      <Text
        style={[styles.text, { color: themeColors.textPrimary }]}
      >
        {status.toUpperCase()}
      </Text>
    </View>
  );
}

// ============================================================================
// NEW APPROACH (HOC Pattern) - RECOMMENDED
// ============================================================================

interface StatusBadgeProps extends WithCaptureThemeProps {
  status: "success" | "error" | "pending";
}

/**
 * Base component - receives theme automatically via HOC
 * Export this for testing purposes
 */
export function StatusBadgeBase({ theme, status }: StatusBadgeProps) {
  const { colors: themeColors, isDark } = theme;

  const bgColor =
    status === "success"
      ? themeColors.successBg
      : status === "error"
        ? themeColors.errorBg
        : themeColors.pendingBg;

  const icon =
    status === "success"
      ? "check-circle"
      : status === "error"
        ? "x-circle"
        : "clock";

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Feather
        name={icon}
        size={14}
        color={isDark ? colors.neutral[100] : colors.neutral[900]}
      />
      <Text style={[styles.text, { color: themeColors.textPrimary }]}>
        {status.toUpperCase()}
      </Text>
    </View>
  );
}

/**
 * Wrapped component with automatic theme injection
 * Use this in your application code
 */
export const StatusBadge = withCaptureTheme(StatusBadgeBase);

// ============================================================================
// USAGE COMPARISON
// ============================================================================

/*
// OLD WAY (Parent must handle theme):
import { useCaptureTheme } from "../../hooks/useCaptureTheme";

function ParentComponentOld() {
  const { themeColors, isDark } = useCaptureTheme();

  return (
    <StatusBadgeOld
      status="success"
      themeColors={themeColors}
      isDark={isDark}
    />
  );
}

// NEW WAY (Parent doesn't need to know about theme):
function ParentComponentNew() {
  return <StatusBadge status="success" />;
}
*/

// ============================================================================
// TESTING
// ============================================================================

/*
import { render } from "@testing-library/react-native";
import { StatusBadgeBase } from "./StatusBadge.example";
import type { CaptureTheme } from "../../hoc";

describe("StatusBadge", () => {
  const mockTheme: CaptureTheme = {
    colors: {
      successBg: "#4CAF50",
      errorBg: "#F44336",
      pendingBg: "#FFC107",
      textPrimary: "#000000",
    },
    isDark: false,
  };

  it("renders success status", () => {
    const { getByText } = render(
      <StatusBadgeBase theme={mockTheme} status="success" />
    );

    expect(getByText("SUCCESS")).toBeTruthy();
  });

  it("adapts to dark mode", () => {
    const darkTheme = { ...mockTheme, isDark: true };

    const { container } = render(
      <StatusBadgeBase theme={darkTheme} status="error" />
    );

    // Icon color should be light in dark mode
    // Assert icon color or other dark mode specific behavior
  });
});
*/

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
});
