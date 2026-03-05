/**
 * Capture Tools Configuration
 * Extracted from CaptureScreen.tsx for testability (Story 8.21).
 *
 * Defines capture tool constants and the computation logic for which tools
 * are visible based on feature flags. Pure module — no native dependencies.
 */
import type { Feather } from "@expo/vector-icons";

import { colors } from "../../design-system/tokens";

export interface CaptureTool {
  id: string;
  labelKey: string;
  iconName: keyof typeof Feather.glyphMap;
  color: string;
  available: boolean;
}

/**
 * Capture tools configuration
 *
 * Icon design principles:
 * - Symbolic, not literal (represent the action/concept)
 * - Minimalist line icons (Feather)
 * - Consistent visual weight
 *
 * Media tools (photo, url, document, clipboard) are feature-gated.
 * They are only shown when capture_media_buttons feature is enabled (AC5).
 *
 * Live transcription tool is feature-gated (Story 8.21).
 * It is only shown when live_transcription feature is enabled (OFF by default).
 */
export const CAPTURE_TOOLS_ALWAYS: CaptureTool[] = [
  {
    id: "voice",
    labelKey: "capture.tools.voice",
    iconName: "mic", // Universal microphone symbol
    color: colors.primary[500],
    available: true,
  },
  {
    id: "text",
    labelKey: "capture.tools.text",
    iconName: "type", // Typography symbol = text input
    color: colors.secondary[500],
    available: true,
  },
];

/** Story 8.21 AC2/AC3: Live transcription tool — only shown when live_transcription feature is enabled */
export const CAPTURE_TOOLS_LIVE: CaptureTool[] = [
  {
    id: "live",
    labelKey: "capture.tools.live",
    iconName: "zap", // Instant / real-time symbol
    color: colors.warning[500],
    available: true,
  },
];

/** Story 24.3 AC5: Media capture tools — only shown when capture_media_buttons feature is enabled */
export const CAPTURE_TOOLS_MEDIA: CaptureTool[] = [
  {
    id: "photo",
    labelKey: "capture.tools.photo",
    iconName: "aperture", // Aperture = photography concept
    color: colors.info[500],
    available: false,
  },
  {
    id: "url",
    labelKey: "capture.tools.url",
    iconName: "globe", // Globe = web/internet
    color: colors.primary[700],
    available: false,
  },
  {
    id: "document",
    labelKey: "capture.tools.document",
    iconName: "file", // Simple file symbol
    color: colors.secondary[700],
    available: false,
  },
  {
    id: "clipboard",
    labelKey: "capture.tools.clipboard",
    iconName: "copy", // Copy = clipboard action
    color: colors.warning[500],
    available: false,
  },
];

/**
 * Computes the visible capture tools based on active feature flags.
 * Pure function — safe to test without native dependencies.
 *
 * @param isLiveEnabled - Value of live_transcription feature flag
 * @param showMediaButtons - Value of capture_media_buttons feature flag
 */
export function computeCaptureTools(
  isLiveEnabled: boolean | undefined,
  showMediaButtons: boolean | undefined
): CaptureTool[] {
  return [
    ...CAPTURE_TOOLS_ALWAYS,
    ...(isLiveEnabled ? CAPTURE_TOOLS_LIVE : []),
    ...(showMediaButtons ? CAPTURE_TOOLS_MEDIA : []),
  ];
}
