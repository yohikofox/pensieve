import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { Capture } from "../../contexts/capture/domain/Capture.model";
import { RetryLimitService } from "../../contexts/Normalization/services/RetryLimitService";
import { useSettingsStore } from "../../stores/settingsStore";
import { useTheme } from "../../hooks/useTheme";
import { colors } from "../../design-system/tokens";
import { Badge, IconButton } from "../../design-system/components";
import {
  CaptureIcons,
  StatusIcons,
  MediaIcons,
  ActionIcons,
} from "../../design-system/icons";
import { PulsingBadge } from "../animations/PulsingBadge";
import { GerminationBadge } from "../animations/GerminationBadge";
import { CaptureCardLayout } from "./CaptureCardLayout";

type CaptureWithQueue = Capture & { isInQueue?: boolean };

interface AudioCaptureCardProps {
  item: CaptureWithQueue;
  playback: {
    isPlaying: boolean;
    isPlayingWav: boolean;
    hasModelAvailable: boolean | null;
  };
  handlers: {
    onPress: () => void;
    onStop: () => void;
    onPlayPause: () => void;
    onTranscribe: () => void;
    onRetry: () => void;
    onPlayWav?: () => void;
    onDeleteWav?: () => void;
  };
}

export function AudioCaptureCard({
  item,
  playback,
  handlers,
}: AudioCaptureCardProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const debugMode = useSettingsStore((state) => state.debugMode);
  const autoTranscriptionEnabled = useSettingsStore(
    (state) => state.autoTranscriptionEnabled,
  );

  const { isPlaying, isPlayingWav, hasModelAvailable } = playback;
  const {
    onPress,
    onStop,
    onPlayPause,
    onTranscribe,
    onRetry,
    onPlayWav,
    onDeleteWav,
  } = handlers;

  const isProcessing = item.state === "processing" || item.isInQueue === true;
  const isStateProcessing = item.state === "processing";
  const isReady = item.state === "ready";
  const isFailed = item.state === "failed";
  const isCaptured = item.state === "captured";

  const retryService = new RetryLimitService();
  const retryCheck = retryService.canRetry(item as any);
  const canRetry = retryCheck.allowed;

  return (
    <CaptureCardLayout
      onPress={onPress}
      icon={CaptureIcons.voice}
      iconBgClass="bg-primary-subtle"
      iconColor={colors.primary[500]}
      label={t("captures.types.audio")}
      duration={item.duration ?? undefined}
      capturedAt={item.capturedAt || item.createdAt}
      createdAt={item.createdAt}
    >
      {/* Status Badge + Action Buttons */}
      <View className="flex-row items-center justify-between mb-3">
        {/* Status Badge */}
        <View>
          {isCaptured &&
            hasModelAvailable === false &&
            !item.normalizedText && (
              <Badge variant="failed">
                <View className="flex-row items-center">
                  <Feather
                    name="alert-circle"
                    size={12}
                    color={isDark ? colors.error[400] : colors.error[700]}
                  />
                  <Text className="ml-1 text-xs font-medium text-status-error-text">
                    {t("capture.status.pendingModel", "Modèle requis")}
                  </Text>
                </View>
              </Badge>
            )}

          {isCaptured &&
            (hasModelAvailable === true ||
              hasModelAvailable === null ||
              item.normalizedText) && (
              <PulsingBadge enabled={item.isInQueue}>
                <Badge variant={item.isInQueue ? "processing" : "pending"}>
                  <View className="flex-row items-center">
                    {item.isInQueue ? (
                      <>
                        <ActivityIndicator
                          size="small"
                          color={isDark ? colors.info[400] : colors.info[700]}
                        />
                        <Text className="ml-2 text-xs font-medium text-status-info-text">
                          {t("capture.status.queued")}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Feather
                          name={StatusIcons.pending}
                          size={12}
                          color={
                            isDark ? colors.warning[400] : colors.warning[700]
                          }
                        />
                        <Text className="ml-1 text-xs font-medium text-status-warning-text">
                          {autoTranscriptionEnabled
                            ? t("capture.status.pending")
                            : t("capture.status.manual")}
                        </Text>
                      </>
                    )}
                  </View>
                </Badge>
              </PulsingBadge>
            )}

          {isStateProcessing && (
            <PulsingBadge enabled={true}>
              <Badge variant="processing">
                <View className="flex-row items-center">
                  <ActivityIndicator
                    size="small"
                    color={isDark ? colors.info[400] : colors.info[700]}
                  />
                  <Text className="ml-2 text-xs font-medium text-status-info-text">
                    {t("capture.status.processing")}
                  </Text>
                </View>
              </Badge>
            </PulsingBadge>
          )}

          {isReady && (
            <GerminationBadge enabled={true}>
              <Badge variant="ready">
                <View className="flex-row items-center">
                  <Feather
                    name={StatusIcons.success}
                    size={12}
                    color={isDark ? colors.success[400] : colors.success[700]}
                  />
                  <Text className="ml-1 text-xs font-medium text-status-success-text">
                    {t("capture.status.ready")}
                  </Text>
                </View>
              </Badge>
            </GerminationBadge>
          )}

          {isFailed && (
            <Badge variant="failed">
              <View className="flex-row items-center">
                <Feather
                  name={StatusIcons.error}
                  size={12}
                  color={isDark ? colors.error[400] : colors.error[700]}
                />
                <Text className="ml-1 text-xs font-medium text-status-error-text">
                  {t("capture.status.failed")}
                </Text>
              </View>
            </Badge>
          )}
        </View>

        {/* Action Buttons */}
        <View className="flex-row items-center gap-2">
          {isPlaying && (
            <TouchableOpacity
              className="w-10 h-10 rounded-lg bg-error-500 items-center justify-center"
              activeOpacity={0.7}
              onPress={(e) => {
                e.stopPropagation();
                onStop();
              }}
            >
              <Feather name="square" size={22} color={colors.neutral[0]} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            className="w-10 h-10 rounded-lg bg-success-500 items-center justify-center"
            activeOpacity={0.7}
            onPress={(e) => {
              e.stopPropagation();
              onPlayPause();
            }}
          >
            <Feather
              name={isPlaying ? MediaIcons.pause : MediaIcons.play}
              size={24}
              color={colors.neutral[0]}
              style={!isPlaying ? { marginLeft: 24 * 0.15 } : undefined}
            />
          </TouchableOpacity>

          {isCaptured && !isProcessing && (
            <TouchableOpacity
              className="w-10 h-10 rounded-lg bg-primary-500 items-center justify-center"
              activeOpacity={0.7}
              onPress={(e) => {
                e.stopPropagation();
                onTranscribe();
              }}
            >
              <Feather name="file-text" size={22} color={colors.neutral[0]} />
            </TouchableOpacity>
          )}

          {isFailed && (
            <View>
              <TouchableOpacity
                className={`w-10 h-10 rounded-lg items-center justify-center ${
                  canRetry ? "bg-warning-500" : "bg-neutral-300"
                }`}
                activeOpacity={canRetry ? 0.7 : 1}
                disabled={!canRetry}
                onPress={(e) => {
                  e.stopPropagation();
                  if (canRetry) {
                    onRetry();
                  }
                }}
              >
                <Feather
                  name="refresh-cw"
                  size={22}
                  color={canRetry ? colors.neutral[0] : colors.neutral[500]}
                />
              </TouchableOpacity>
              {!canRetry && retryCheck.remainingTime && (
                <Text
                  className="text-xs text-error-600 mt-1 text-center"
                  style={{ maxWidth: 120 }}
                >
                  {`Limite atteinte. ${retryCheck.remainingTime} min`}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Content */}
      <View>
        {debugMode && item.wavPath && onPlayWav && onDeleteWav && (
          <View className="flex-row items-center gap-2 mb-2">
            <TouchableOpacity
              className="flex-row items-center px-2 py-1.5 rounded-lg border"
              style={{
                backgroundColor: isDark
                  ? colors.success[900]
                  : colors.success[50],
                borderColor: isDark ? colors.success[700] : colors.success[200],
              }}
              onPress={(e) => {
                e.stopPropagation();
                onPlayWav();
              }}
            >
              <Feather
                name={isPlayingWav ? MediaIcons.pause : MediaIcons.volume}
                size={14}
                color={isDark ? colors.success[400] : colors.success[700]}
              />
              <Text
                className="ml-1 text-xs font-medium"
                style={{
                  color: isDark ? colors.success[400] : colors.success[700],
                }}
              >
                WAV
              </Text>
            </TouchableOpacity>
            <IconButton
              icon={ActionIcons.delete}
              size="sm"
              variant="ghost"
              color={isDark ? colors.error[400] : colors.error[600]}
              className="border"
              style={{
                backgroundColor: isDark ? colors.error[900] : colors.error[50],
                borderColor: isDark ? colors.error[700] : colors.error[200],
              }}
              onPress={(e) => {
                e.stopPropagation();
                onDeleteWav();
              }}
            />
          </View>
        )}

        {item.normalizedText ? (
          <Text
            className="text-base text-text-primary leading-relaxed"
            numberOfLines={4}
          >
            {item.normalizedText}
          </Text>
        ) : isProcessing ? (
          <Text className="text-sm text-text-tertiary italic">
            {t("capture.status.processing")}
            {"..."}
          </Text>
        ) : isCaptured ? (
          <Text className="text-sm text-text-tertiary italic">
            {autoTranscriptionEnabled
              ? t("capture.status.pending")
              : t("capture.status.manual")}
          </Text>
        ) : isFailed ? (
          <View>
            <Text className="text-sm text-status-error italic">
              {debugMode && item.transcriptionError
                ? item.transcriptionError
                : t("capture.status.failed", "La transcription a échoué")}
            </Text>
          </View>
        ) : null}
      </View>
    </CaptureCardLayout>
  );
}
