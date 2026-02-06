/**
 * ContactPickerModal Component
 *
 * Full-screen modal for selecting contacts for action items
 * Story 5.1 - Refactoring: Extract contact picker responsibility
 * Story 5.4 - Refactored to consume theme from hook instead of props
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
} from "react-native";
import * as Contacts from "expo-contacts";
import { colors } from "../../design-system/tokens";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";

interface ContactPickerModalProps {
  visible: boolean;
  loadingContacts: boolean;
  contactSearchQuery: string;
  filteredContacts: Contacts.Contact[];
  onClose: () => void;
  onSearchChange: (query: string) => void;
  onSelectContact: (contact: Contacts.Contact) => void;
}

export function ContactPickerModal({
  visible,
  loadingContacts,
  contactSearchQuery,
  filteredContacts,
  onClose,
  onSearchChange,
  onSelectContact,
}: ContactPickerModalProps) {
  const { themeColors } = useCaptureTheme();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.contactPickerContainer,
          { backgroundColor: themeColors.contactBg },
        ]}
      >
        <View
          style={[
            styles.contactPickerHeader,
            {
              backgroundColor: themeColors.contactHeaderBg,
              borderBottomColor: themeColors.borderDefault,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.contactPickerCloseButton}
            onPress={onClose}
          >
            <Text
              style={[
                styles.contactPickerCloseText,
                { color: colors.primary[500] },
              ]}
            >
              Fermer
            </Text>
          </TouchableOpacity>
          <Text
            style={[
              styles.contactPickerTitle,
              { color: themeColors.textPrimary },
            ]}
          >
            Choisir un contact
          </Text>
          <View style={{ width: 60 }} />
        </View>
        <View
          style={[
            styles.contactSearchContainer,
            { backgroundColor: themeColors.contactHeaderBg },
          ]}
        >
          <TextInput
            style={[
              styles.contactSearchInput,
              {
                backgroundColor: themeColors.contactSearchBg,
                color: themeColors.textPrimary,
              },
            ]}
            placeholder="Rechercher..."
            placeholderTextColor={themeColors.textMuted}
            value={contactSearchQuery}
            onChangeText={onSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {loadingContacts ? (
          <View style={styles.contactLoadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
            <Text
              style={[
                styles.contactLoadingText,
                { color: themeColors.textSecondary },
              ]}
            >
              Chargement des contacts...
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            keyExtractor={(item, index) =>
              (item as { id?: string }).id || `contact-${index}`
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.contactItem,
                  {
                    backgroundColor: themeColors.contactItemBg,
                    borderBottomColor: themeColors.borderDefault,
                  },
                ]}
                onPress={() => onSelectContact(item)}
              >
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactAvatarText}>
                    {item.name?.charAt(0).toUpperCase() || "?"}
                  </Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text
                    style={[
                      styles.contactName,
                      { color: themeColors.textPrimary },
                    ]}
                  >
                    {item.name || "Sans nom"}
                  </Text>
                  {item.phoneNumbers && item.phoneNumbers.length > 0 && (
                    <Text
                      style={[
                        styles.contactPhone,
                        { color: themeColors.textMuted },
                      ]}
                    >
                      {item.phoneNumbers[0].number}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.contactEmptyContainer}>
                <Text
                  style={[
                    styles.contactEmptyText,
                    { color: themeColors.textMuted },
                  ]}
                >
                  Aucun contact trouvé
                </Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  contactPickerContainer: {
    flex: 1,
  },
  contactPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  contactPickerCloseButton: {
    width: 60,
  },
  contactPickerCloseText: {
    fontSize: 17,
  },
  contactPickerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  contactSearchContainer: {
    padding: 12,
  },
  contactSearchInput: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  contactLoadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  contactLoadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#9C27B0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  contactAvatarText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "500",
  },
  contactPhone: {
    fontSize: 14,
    marginTop: 2,
  },
  contactEmptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  contactEmptyText: {
    fontSize: 16,
  },
});
