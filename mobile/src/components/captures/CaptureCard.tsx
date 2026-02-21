import React from "react";
import { View, Text } from "react-native";
import type { Capture } from "../../contexts/capture/domain/Capture.model";
import { AudioCaptureCard } from "./AudioCaptureCard";
import { TextCaptureCard } from "./TextCaptureCard";

type CaptureWithQueue = Capture & {
  isInQueue?: boolean;
};

interface CaptureCardProps {
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

export function CaptureCard({ item, playback, handlers }: CaptureCardProps) {
  switch (item.type) {
    case "audio":
      return (
        <AudioCaptureCard item={item} playback={playback} handlers={handlers} />
      );
    case "text":
      return <TextCaptureCard item={item} onPress={handlers.onPress} />;
    default:
      return (
        <View>
          <Text>{item.type}</Text>
        </View>
      );
  }
}
