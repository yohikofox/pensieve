/**
 * Capture Tools Configuration
 * Extracted from CaptureScreen.tsx for testability (Story 8.21).
 * Story 8.22: Refactoring — chaque outil média est désormais contrôlé par son
 * propre feature flag (capacité produit), remplaçant le flag bloc capture_media_buttons.
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
 * Chaque outil média est contrôlé individuellement par son feature flag (Story 8.22) :
 *   - url_capture      → CAPTURE_TOOLS_URL
 *   - photo_capture    → CAPTURE_TOOLS_PHOTO
 *   - document_capture → CAPTURE_TOOLS_DOCUMENT
 *   - clipboard_capture→ CAPTURE_TOOLS_CLIPBOARD
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

/** Story 8.22 AC5: URL capture tool — only shown when url_capture feature is enabled */
export const CAPTURE_TOOLS_URL: CaptureTool[] = [
  {
    id: "url",
    labelKey: "capture.tools.url",
    iconName: "globe", // Globe = web/internet
    color: colors.primary[700],
    available: false,
  },
];

/** Story 8.22 AC5: Photo capture tool — only shown when photo_capture feature is enabled */
export const CAPTURE_TOOLS_PHOTO: CaptureTool[] = [
  {
    id: "photo",
    labelKey: "capture.tools.photo",
    iconName: "aperture", // Aperture = photography concept
    color: colors.info[500],
    available: false,
  },
];

/** Story 8.22 AC5: Document capture tool — only shown when document_capture feature is enabled */
export const CAPTURE_TOOLS_DOCUMENT: CaptureTool[] = [
  {
    id: "document",
    labelKey: "capture.tools.document",
    iconName: "file", // Simple file symbol
    color: colors.secondary[700],
    available: false,
  },
];

/** Story 8.22 AC5: Clipboard capture tool — only shown when clipboard_capture feature is enabled */
export const CAPTURE_TOOLS_CLIPBOARD: CaptureTool[] = [
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
 * Story 8.22: chaque outil média est contrôlé par son propre flag (granularité capacité produit).
 *
 * @param isLiveEnabled      - Value of live_transcription feature flag
 * @param isUrlEnabled       - Value of url_capture feature flag
 * @param isPhotoEnabled     - Value of photo_capture feature flag
 * @param isDocumentEnabled  - Value of document_capture feature flag
 * @param isClipboardEnabled - Value of clipboard_capture feature flag
 */
export function computeCaptureTools(
  isLiveEnabled: boolean | undefined,
  isUrlEnabled?: boolean | undefined,
  isPhotoEnabled?: boolean | undefined,
  isDocumentEnabled?: boolean | undefined,
  isClipboardEnabled?: boolean | undefined,
): CaptureTool[] {
  return [
    ...CAPTURE_TOOLS_ALWAYS,
    ...(isLiveEnabled    ? CAPTURE_TOOLS_LIVE      : []),
    ...(isUrlEnabled     ? CAPTURE_TOOLS_URL        : []),
    ...(isPhotoEnabled   ? CAPTURE_TOOLS_PHOTO      : []),
    ...(isDocumentEnabled  ? CAPTURE_TOOLS_DOCUMENT : []),
    ...(isClipboardEnabled ? CAPTURE_TOOLS_CLIPBOARD : []),
  ];
}
