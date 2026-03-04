/**
 * CaptureAudioPlayerSection
 *
 * Business logic layer for audio playback in capture context.
 * Knows about captures, extracts audio data, and delegates to generic AudioPlayerSection.
 *
 * Responsibilities:
 * - Access capture from store
 * - Validate capture is audio type with content
 * - Extract audio URI and metadata
 * - Resolve local file path via syncAudioForCapture if rawContent is not a local path
 * - Expose manual retry button when audio is unavailable or resolution failed
 * - Manage audio position in store
 * - Delegate rendering to generic AudioPlayerSection
 *
 * Story 5.4 - Separation of Concerns: Business vs Presentation
 */

import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { AudioPlayerSection } from "./AudioPlayerSection";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";
import { LazyAudioDownloader } from "../../infrastructure/sync/LazyAudioDownloader";

export interface CaptureAudioPlayerSectionProps {
  onPositionChange?: (positionMs: number) => void;
  onPlaybackEnd?: () => void;
}

type AudioResolutionState = "idle" | "resolving" | "ready" | "failed";

function isLocalPath(path: string): boolean {
  return path.startsWith("file://") || path.startsWith("/");
}

export function CaptureAudioPlayerSection({
  onPositionChange,
  onPlaybackEnd,
}: CaptureAudioPlayerSectionProps) {
  const capture = useCaptureDetailStore((state) => state.capture);
  const metadata = useCaptureDetailStore((state) => state.metadata);
  const setAudioPosition = useCaptureDetailStore((state) => state.setAudioPosition);

  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const [state, setState] = useState<AudioResolutionState>("idle");

  const resolveAudio = useCallback(async (captureId: string) => {
    setState("resolving");
    try {
      const downloader = new LazyAudioDownloader();
      const localPath = await downloader.syncAudioForCapture(captureId);
      if (localPath) {
        setResolvedUri(localPath);
        setState("ready");
      } else {
        console.warn(`[CaptureAudioPlayerSection] syncAudioForCapture returned null for ${captureId}`);
        setState("failed");
      }
    } catch (err) {
      console.error(`[CaptureAudioPlayerSection] Resolution failed for ${captureId}:`, err);
      setState("failed");
    }
  }, []);

  useEffect(() => {
    if (!capture || capture.type !== "audio") return;

    const raw = capture.rawContent;

    if (!raw) {
      // Pas de rawContent du tout : tenter quand même via syncAudioForCapture (audio_local_path / audio_url)
      console.warn(`[CaptureAudioPlayerSection] rawContent absent pour ${capture.id} — tentative via syncAudioForCapture`);
      resolveAudio(capture.id);
      return;
    }

    if (isLocalPath(raw)) {
      setResolvedUri(raw);
      setState("ready");
      return;
    }

    // rawContent est un path non-local (ex: path Supabase) — alerter et résoudre
    console.warn(
      `[CaptureAudioPlayerSection] rawContent non-local détecté pour ${capture.id}: "${raw}" — résolution en cours`
    );
    resolveAudio(capture.id);
  }, [capture?.id, capture?.rawContent, resolveAudio]);

  if (!capture || capture.type !== "audio") return null;

  const handlePositionChange = (positionMs: number) => {
    setAudioPosition(positionMs);
    onPositionChange?.(positionMs);
  };

  const handlePlaybackEnd = () => {
    setAudioPosition(0);
    onPlaybackEnd?.();
  };

  if (state === "resolving") {
    return (
      <View className="flex-row items-center gap-2 px-4 py-3">
        <ActivityIndicator size="small" />
        <Text className="text-sm text-muted-foreground">Récupération de l'audio…</Text>
      </View>
    );
  }

  if (state === "failed" || (state !== "ready" && !resolvedUri)) {
    return (
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-sm text-destructive">Audio non disponible localement</Text>
        <Pressable
          onPress={() => resolveAudio(capture.id)}
          className="ml-3 rounded-md bg-primary px-3 py-1.5"
        >
          <Text className="text-sm font-medium text-primary-foreground">Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  if (!resolvedUri) return null;

  return (
    <AudioPlayerSection
      audioUri={resolvedUri}
      captureId={capture.id}
      metadata={metadata}
      onPositionChange={handlePositionChange}
      onPlaybackEnd={handlePlaybackEnd}
    />
  );
}
