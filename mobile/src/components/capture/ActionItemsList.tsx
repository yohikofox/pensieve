/**
 * ActionItemsList Component
 *
 * Displays and manages action items extracted from captures
 * Features:
 * - Display action items with deadline and target
 * - Edit deadline (date picker)
 * - Edit target (contact picker)
 * - Add to Google Calendar
 * - Auto-save on edits
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../design-system/tokens";
import { formatDeadlineDate, type ActionItem } from "../../contexts/capture/utils/actionItemParser";
import { SavedIndicator } from "./SavedIndicator";

interface ActionItemsListProps {
  actionItems: ActionItem[];
  isDark: boolean;
  themeColors: {
    actionItemBg: string;
    actionItemBorder: string;
    actionItemTagBg: string;
    analysisBorder: string;
    textPrimary: string;
  };
  savingActionIndex: number | null;
  savedActionIndex: number | null;
  addingToCalendarIndex: number | null;
  addedToCalendarIndex: number | null;
  onOpenDatePicker: (index: number) => void;
  onOpenContactPicker: (index: number) => void;
  onAddToCalendar: (index: number, item: ActionItem) => void;
  onSavedIndicatorHidden: () => void;
  highlightTodoId?: string;
}

export function ActionItemsList({
  actionItems,
  isDark,
  themeColors,
  savingActionIndex,
  savedActionIndex,
  addingToCalendarIndex,
  addedToCalendarIndex,
  onOpenDatePicker,
  onOpenContactPicker,
  onAddToCalendar,
  onSavedIndicatorHidden,
  highlightTodoId,
}: ActionItemsListProps) {
  return (
    <View style={styles.container}>
      {actionItems.map((item, index) => (
        <View
          key={index}
          style={[
            styles.actionItem,
            {
              backgroundColor: themeColors.actionItemBg,
              borderColor: themeColors.actionItemBorder,
            },
          ]}
        >
          {/* Header with checkbox and title */}
          <View style={styles.actionItemHeader}>
            <View
              style={[
                styles.actionItemCheckbox,
                {
                  borderColor: isDark
                    ? colors.primary[400]
                    : colors.primary[600],
                },
              ]}
            />
            <Text
              style={[
                styles.actionItemTitle,
                { color: themeColors.textPrimary },
              ]}
              selectable
            >
              {item.title}
            </Text>
          </View>

          {/* Save indicator */}
          {savingActionIndex === index && (
            <View style={styles.actionItemSaveIndicator}>
              <ActivityIndicator size="small" color="#9C27B0" />
            </View>
          )}
          <SavedIndicator
            visible={savedActionIndex === index}
            onHidden={onSavedIndicatorHidden}
          />

          {/* Meta tags (deadline, target, calendar) */}
          <View style={styles.actionItemMeta}>
            {/* Deadline tag - always clickable */}
            <TouchableOpacity
              style={[
                styles.actionItemTag,
                {
                  backgroundColor: themeColors.actionItemTagBg,
                  borderColor: themeColors.analysisBorder,
                },
                !item.deadline_date &&
                  !item.deadline_text && {
                    backgroundColor: isDark
                      ? colors.neutral[800]
                      : "#FAFAFA",
                    borderStyle: "dashed",
                  },
              ]}
              onPress={() => onOpenDatePicker(index)}
            >
              <Feather
                name="calendar"
                size={13}
                color={
                  isDark ? colors.primary[400] : colors.primary[700]
                }
                style={styles.actionItemTagIconFeather}
              />
              <Text
                style={[
                  styles.actionItemTagText,
                  {
                    color: isDark
                      ? colors.primary[300]
                      : colors.primary[700],
                  },
                  !item.deadline_date &&
                    !item.deadline_text && {
                      fontStyle: "italic",
                    },
                ]}
              >
                {item.deadline_date
                  ? formatDeadlineDate(item.deadline_date)
                  : item.deadline_text || "Ajouter date"}
              </Text>
            </TouchableOpacity>

            {/* Target tag - always clickable */}
            <TouchableOpacity
              style={[
                styles.actionItemTag,
                {
                  backgroundColor: themeColors.actionItemTagBg,
                  borderColor: themeColors.analysisBorder,
                },
                !item.target && {
                  backgroundColor: isDark
                    ? colors.neutral[800]
                    : "#FAFAFA",
                  borderStyle: "dashed",
                },
              ]}
              onPress={() => onOpenContactPicker(index)}
            >
              <Feather
                name="user"
                size={13}
                color={
                  isDark ? colors.primary[400] : colors.primary[700]
                }
                style={styles.actionItemTagIconFeather}
              />
              <Text
                style={[
                  styles.actionItemTagText,
                  {
                    color: isDark
                      ? colors.primary[300]
                      : colors.primary[700],
                  },
                  !item.target && {
                    fontStyle: "italic",
                  },
                ]}
              >
                {item.target || "Ajouter contact"}
              </Text>
            </TouchableOpacity>

            {/* Add to Calendar button - only when date exists */}
            {item.deadline_date && (
              <TouchableOpacity
                style={[
                  styles.actionItemTag,
                  styles.actionItemCalendarButton,
                  addedToCalendarIndex === index &&
                    styles.actionItemCalendarButtonDone,
                ]}
                onPress={() => onAddToCalendar(index, item)}
                disabled={addingToCalendarIndex === index}
              >
                {addingToCalendarIndex === index ? (
                  <ActivityIndicator size="small" color="#4285F4" />
                ) : addedToCalendarIndex === index ? (
                  <>
                    <Feather
                      name="check"
                      size={13}
                      color={colors.success[600]}
                      style={styles.actionItemTagIconFeather}
                    />
                    <Text style={styles.actionItemCalendarTextDone}>
                      Ajouté
                    </Text>
                  </>
                ) : (
                  <>
                    <Feather
                      name="calendar"
                      size={13}
                      color={colors.info[600]}
                      style={styles.actionItemTagIconFeather}
                    />
                    <Text style={styles.actionItemCalendarText}>
                      Calendrier
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  actionItem: {
    backgroundColor: "#FAFAFA",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    marginBottom: 12,
  },
  actionItemHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionItemCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#9C27B0",
    marginRight: 12,
  },
  actionItemTitle: {
    flex: 1,
    fontSize: 15,
    color: "#1A1A1A",
    lineHeight: 22,
    fontWeight: "500",
  },
  actionItemMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    paddingLeft: 32,
    gap: 8,
  },
  actionItemTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3E5F5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  actionItemTagIconFeather: {
    marginRight: 5,
  },
  actionItemTagText: {
    fontSize: 13,
    color: "#7B1FA2",
    fontWeight: "500",
  },
  actionItemSaveIndicator: {
    position: "absolute",
    bottom: 8,
    right: 8,
  },
  actionItemCalendarButton: {
    backgroundColor: "#E8F0FE",
    borderWidth: 1,
    borderColor: "#4285F4",
  },
  actionItemCalendarButtonDone: {
    backgroundColor: "#E8F5E9",
    borderColor: "#32CD32",
  },
  actionItemCalendarText: {
    fontSize: 13,
    color: "#4285F4",
    fontWeight: "500",
  },
  actionItemCalendarTextDone: {
    fontSize: 13,
    color: "#32CD32",
    fontWeight: "500",
  },
});
