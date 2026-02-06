/**
 * DatePickerModal Component
 *
 * Modal for selecting date/time for action items
 * Story 5.1 - Refactoring: Extract date picker responsibility
 */

import React from "react";
import DateTimePickerModal from "react-native-modal-datetime-picker";

interface DatePickerModalProps {
  visible: boolean;
  selectedDate: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

export function DatePickerModal({
  visible,
  selectedDate,
  onConfirm,
  onCancel,
}: DatePickerModalProps) {
  return (
    <DateTimePickerModal
      isVisible={visible}
      mode="datetime"
      date={selectedDate}
      onConfirm={onConfirm}
      onCancel={onCancel}
      locale="fr"
      confirmTextIOS="OK"
      cancelTextIOS="Annuler"
    />
  );
}
