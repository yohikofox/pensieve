import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Card } from "../../design-system/components";
import { MaturityBadge } from "../animations/MaturityBadge";

interface CaptureCardLayoutProps {
  onPress: () => void;
  icon: React.ComponentProps<typeof Feather>["name"];
  iconBgClass: string;
  iconColor: string;
  label: string;
  duration?: number;
  capturedAt: Date;
  createdAt: Date;
  children: React.ReactNode;
}

export function CaptureCardLayout({
  onPress,
  icon,
  iconBgClass,
  iconColor,
  label,
  duration,
  capturedAt,
  createdAt,
  children,
}: CaptureCardLayoutProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card className="mb-3">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center">
            <View
              className={`w-8 h-8 rounded-full items-center justify-center mr-2 ${iconBgClass}`}
            >
              <Feather name={icon} size={16} color={iconColor} />
            </View>
            <Text className="text-sm font-semibold text-text-primary">
              {label}
            </Text>
            {!!duration && (
              <Text className="text-sm text-text-tertiary ml-1">
                {`· ${Math.floor(duration / 1000)}s`}
              </Text>
            )}
          </View>
          <View className="flex-row items-center">
            <MaturityBadge capturedAt={capturedAt} variant="minimal" />
            <Text className="text-xs text-text-tertiary ml-2">
              {createdAt.toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>

        {children}
      </Card>
    </TouchableOpacity>
  );
}
