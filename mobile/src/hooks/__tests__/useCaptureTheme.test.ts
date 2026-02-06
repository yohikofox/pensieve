/**
 * Tests for useCaptureTheme hook
 *
 * Validates theme color calculation for all color schemes and dark/light modes.
 */

import { renderHook } from "@testing-library/react-native";
import { useCaptureTheme } from "../useCaptureTheme";
import * as useThemeModule from "../useTheme";
import type { ColorScheme } from "../../design-system/tokens";

// Mock useTheme hook
jest.mock("../useTheme");

describe("useCaptureTheme", () => {
  const mockUseTheme = useThemeModule.useTheme as jest.MockedFunction<
    typeof useThemeModule.useTheme
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Light mode", () => {
    it("should return light mode colors for blue scheme", () => {
      mockUseTheme.mockReturnValue({
        isDark: false,
        colorSchemePreference: "blue" as ColorScheme,
        toggleTheme: jest.fn(),
        setColorScheme: jest.fn(),
      });

      const { result } = renderHook(() => useCaptureTheme());

      expect(result.current.isDark).toBe(false);
      expect(result.current.colorSchemePreference).toBe("blue");
      expect(result.current.themeColors.textPrimary).toBeDefined();
      expect(result.current.themeColors.screenBg).toBeDefined();

      // Verify specific light mode colors
      expect(result.current.themeColors.textMuted).toBe("#8E8E93");
      expect(result.current.themeColors.statusPendingBg).toBe("#FFF3E0");
    });

    it("should return light mode colors for green scheme", () => {
      mockUseTheme.mockReturnValue({
        isDark: false,
        colorSchemePreference: "green" as ColorScheme,
        toggleTheme: jest.fn(),
        setColorScheme: jest.fn(),
      });

      const { result } = renderHook(() => useCaptureTheme());

      expect(result.current.colorSchemePreference).toBe("green");
      expect(result.current.themeColors).toBeDefined();
    });

    it("should return light mode colors for purple scheme", () => {
      mockUseTheme.mockReturnValue({
        isDark: false,
        colorSchemePreference: "purple" as ColorScheme,
        toggleTheme: jest.fn(),
        setColorScheme: jest.fn(),
      });

      const { result } = renderHook(() => useCaptureTheme());

      expect(result.current.colorSchemePreference).toBe("purple");
      expect(result.current.themeColors).toBeDefined();
    });

    it("should return light mode colors for orange scheme", () => {
      mockUseTheme.mockReturnValue({
        isDark: false,
        colorSchemePreference: "orange" as ColorScheme,
        toggleTheme: jest.fn(),
        setColorScheme: jest.fn(),
      });

      const { result } = renderHook(() => useCaptureTheme());

      expect(result.current.colorSchemePreference).toBe("orange");
      expect(result.current.themeColors).toBeDefined();
    });
  });

  describe("Dark mode", () => {
    it("should return dark mode colors for blue scheme", () => {
      mockUseTheme.mockReturnValue({
        isDark: true,
        colorSchemePreference: "blue" as ColorScheme,
        toggleTheme: jest.fn(),
        setColorScheme: jest.fn(),
      });

      const { result } = renderHook(() => useCaptureTheme());

      expect(result.current.isDark).toBe(true);
      expect(result.current.colorSchemePreference).toBe("blue");

      // Verify dark mode has different colors than light mode
      expect(result.current.themeColors.textMuted).not.toBe("#8E8E93");
      expect(result.current.themeColors.statusPendingBg).not.toBe("#FFF3E0");
    });

    it("should return dark mode colors for green scheme", () => {
      mockUseTheme.mockReturnValue({
        isDark: true,
        colorSchemePreference: "green" as ColorScheme,
        toggleTheme: jest.fn(),
        setColorScheme: jest.fn(),
      });

      const { result } = renderHook(() => useCaptureTheme());

      expect(result.current.isDark).toBe(true);
      expect(result.current.colorSchemePreference).toBe("green");
    });
  });

  describe("Theme color properties", () => {
    beforeEach(() => {
      mockUseTheme.mockReturnValue({
        isDark: false,
        colorSchemePreference: "blue" as ColorScheme,
        toggleTheme: jest.fn(),
        setColorScheme: jest.fn(),
      });
    });

    it("should provide all required background colors", () => {
      const { result } = renderHook(() => useCaptureTheme());
      const { themeColors } = result.current;

      expect(themeColors.screenBg).toBeDefined();
      expect(themeColors.cardBg).toBeDefined();
      expect(themeColors.subtleBg).toBeDefined();
      expect(themeColors.inputBg).toBeDefined();
    });

    it("should provide all required text colors", () => {
      const { result } = renderHook(() => useCaptureTheme());
      const { themeColors } = result.current;

      expect(themeColors.textPrimary).toBeDefined();
      expect(themeColors.textSecondary).toBeDefined();
      expect(themeColors.textTertiary).toBeDefined();
      expect(themeColors.textMuted).toBeDefined();
    });

    it("should provide all required status colors", () => {
      const { result } = renderHook(() => useCaptureTheme());
      const { themeColors } = result.current;

      expect(themeColors.statusPendingBg).toBeDefined();
      expect(themeColors.statusProcessingBg).toBeDefined();
      expect(themeColors.statusReadyBg).toBeDefined();
      expect(themeColors.statusFailedBg).toBeDefined();
    });

    it("should provide all required section colors", () => {
      const { result } = renderHook(() => useCaptureTheme());
      const { themeColors } = result.current;

      // Analysis section
      expect(themeColors.analysisBg).toBeDefined();
      expect(themeColors.analysisBorder).toBeDefined();
      expect(themeColors.analysisContentBg).toBeDefined();

      // Metadata section
      expect(themeColors.metadataBg).toBeDefined();
      expect(themeColors.metadataBorder).toBeDefined();
      expect(themeColors.metadataContentBg).toBeDefined();

      // Actions section
      expect(themeColors.actionsBg).toBeDefined();
      expect(themeColors.actionsBorder).toBeDefined();
      expect(themeColors.actionsContentBg).toBeDefined();
      expect(themeColors.actionsTitle).toBeDefined();
      expect(themeColors.actionButtonBg).toBeDefined();
      expect(themeColors.actionButtonDisabledBg).toBeDefined();
    });

    it("should provide all required reprocess colors", () => {
      const { result } = renderHook(() => useCaptureTheme());
      const { themeColors } = result.current;

      expect(themeColors.reprocessBg).toBeDefined();
      expect(themeColors.reprocessBorder).toBeDefined();
      expect(themeColors.reprocessContentBg).toBeDefined();
      expect(themeColors.reprocessTitle).toBeDefined();
      expect(themeColors.reprocessText).toBeDefined();
      expect(themeColors.reprocessButtonTranscribe).toBeDefined();
      expect(themeColors.reprocessButtonPostProcess).toBeDefined();
    });

    it("should provide all required contact picker colors", () => {
      const { result } = renderHook(() => useCaptureTheme());
      const { themeColors } = result.current;

      expect(themeColors.contactBg).toBeDefined();
      expect(themeColors.contactHeaderBg).toBeDefined();
      expect(themeColors.contactItemBg).toBeDefined();
      expect(themeColors.contactSearchBg).toBeDefined();
    });
  });

  describe("Color scheme switching", () => {
    it("should update colors when color scheme changes", () => {
      mockUseTheme.mockReturnValue({
        isDark: false,
        colorSchemePreference: "blue" as ColorScheme,
        toggleTheme: jest.fn(),
        setColorScheme: jest.fn(),
      });

      const { result, rerender } = renderHook(() => useCaptureTheme());
      const blueColors = result.current.themeColors;

      // Change to green scheme
      mockUseTheme.mockReturnValue({
        isDark: false,
        colorSchemePreference: "green" as ColorScheme,
        toggleTheme: jest.fn(),
        setColorScheme: jest.fn(),
      });

      rerender();

      // Colors object should be different (new instance)
      expect(result.current.themeColors).not.toBe(blueColors);
    });

    it("should update colors when dark mode toggles", () => {
      mockUseTheme.mockReturnValue({
        isDark: false,
        colorSchemePreference: "blue" as ColorScheme,
        toggleTheme: jest.fn(),
        setColorScheme: jest.fn(),
      });

      const { result, rerender } = renderHook(() => useCaptureTheme());
      const lightColors = result.current.themeColors;

      // Toggle to dark mode
      mockUseTheme.mockReturnValue({
        isDark: true,
        colorSchemePreference: "blue" as ColorScheme,
        toggleTheme: jest.fn(),
        setColorScheme: jest.fn(),
      });

      rerender();

      // Colors should be different
      expect(result.current.themeColors).not.toBe(lightColors);
      expect(result.current.themeColors.textPrimary).not.toBe(
        lightColors.textPrimary
      );
    });
  });
});
