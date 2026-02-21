import React from "react";
import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import type { Capture } from "../../contexts/capture/domain/Capture.model";
import { colors } from "../../design-system/tokens";
import { CaptureIcons } from "../../design-system/icons";
import { CaptureCardLayout } from "./CaptureCardLayout";

type CaptureWithQueue = Capture & { isInQueue?: boolean };

interface TextCaptureCardProps {
  item: CaptureWithQueue;
  onPress: () => void;
}

export function TextCaptureCard({ item, onPress }: TextCaptureCardProps) {
  const { t } = useTranslation();

  return (
    <CaptureCardLayout
      onPress={onPress}
      icon={CaptureIcons.text}
      iconBgClass="bg-secondary-subtle"
      iconColor={colors.secondary[500]}
      label={t("captures.types.text")}
      capturedAt={item.capturedAt || item.createdAt}
      createdAt={item.createdAt}
    >
      <Text
        className="text-base text-text-primary leading-relaxed"
        numberOfLines={4}
      >
        {item.rawContent || item.normalizedText || t("captures.empty")}
      </Text>
    </CaptureCardLayout>
  );
}
