/**
 * CaptureDetailScreen Styles
 *
 * StyleSheet definitions for CaptureDetailScreen components.
 * Extracted from CaptureDetailScreen.tsx to improve organization and reduce file size.
 */

import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: "#8E8E93",
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  headerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  typeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  typeLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  date: {
    fontSize: 14,
    color: "#8E8E93",
    marginBottom: 4,
  },
  duration: {
    fontSize: 14,
    color: "#8E8E93",
    marginBottom: 12,
  },
  statusRow: {
    marginTop: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  statusPending: {
    backgroundColor: "#FFF3E0",
  },
  statusProcessing: {
    backgroundColor: "#E3F2FD",
  },
  statusReady: {
    backgroundColor: "#E8F5E9",
  },
  statusFailed: {
    backgroundColor: "#FFEBEE",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  audioCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  contentTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
  },
  contentTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  contentHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  aiEnhancedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  aiEnhancedBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  toggleVersionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleVersionText: {
    fontSize: 12,
    fontWeight: "500",
  },
  unsavedBadge: {
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  unsavedText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#FF9800",
  },
  contentText: {
    fontSize: 17,
    color: "#000",
    lineHeight: 26,
  },
  contentTextInput: {
    fontSize: 17,
    color: "#000",
    lineHeight: 26,
    padding: 0,
    textAlignVertical: "top",
  },
  placeholderText: {
    fontSize: 16,
    color: "#8E8E93",
    fontStyle: "italic",
  },
  rawTranscriptCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    overflow: "hidden",
  },
  rawTranscriptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  rawTranscriptTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rawTranscriptTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginLeft: 8,
  },
  rawTranscriptContent: {
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    padding: 12,
    backgroundColor: "#FAFAFA",
  },
  rawTranscriptText: {
    fontSize: 15,
    color: "#666",
    lineHeight: 22,
    fontStyle: "italic",
  },
  rawTranscriptBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
  },
  rawTranscriptBadgeText: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "500",
  },
  metadataCard: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    overflow: "hidden",
  },
  metadataHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  metadataTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metadataTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginLeft: 8,
  },
  metadataContent: {
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FAFAFA",
  },
  metadataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  metadataLabel: {
    fontSize: 13,
    color: "#666",
    flex: 1,
  },
  metadataValue: {
    fontSize: 13,
    color: "#333",
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
  },
});
