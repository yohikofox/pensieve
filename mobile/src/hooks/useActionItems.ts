/**
 * useActionItems Hook
 *
 * Completely autonomous hook for action items management.
 * Reads all data from stores, no parameters needed.
 *
 * Manages action items lifecycle:
 * - Parsing from LLM analysis
 * - CRUD operations (update, save)
 * - Date picking
 * - Contact selection
 * - Google Calendar integration
 *
 * Story 5.4 - Autonomous hook: reads from stores, no prop drilling
 */

import { useEffect } from "react";
import * as Contacts from "expo-contacts";
import { container } from "tsyringe";
import { TOKENS } from "../infrastructure/di/tokens";
import type { ICaptureAnalysisRepository } from "../contexts/capture/domain/ICaptureAnalysisRepository";
import type { CaptureAnalysis } from "../contexts/capture/domain/CaptureAnalysis.model";
import { ANALYSIS_TYPES } from "../contexts/capture/domain/CaptureAnalysis.model";
import {
  parseActionItems,
  type ActionItem,
} from "../contexts/capture/utils/actionItemParser";
import { GoogleCalendarService } from "../services/GoogleCalendarService";
import { useToast } from "../design-system/components";
import { useCaptureDetailStore } from "../stores/captureDetailStore";
import { useCurrentAnalyses } from "../stores/analysesStore";
import { useAnalysesStore } from "../stores/analysesStore";
import { useActionItemsStore, useCurrentActionItems } from "../stores/actionItemsStore";

interface UseActionItemsReturn {
  // State
  actionItems: ActionItem[] | null;
  savingActionIndex: number | null;
  savedActionIndex: number | null;
  editingActionIndex: number | null;
  addedToCalendarIndex: number | null;
  addingToCalendarIndex: number | null;
  showDatePicker: boolean;
  showContactPicker: boolean;
  selectedDate: Date;
  contacts: Contacts.Contact[];
  contactSearchQuery: string;
  loadingContacts: boolean;
  filteredContacts: Contacts.Contact[];
  showCalendarDialog: boolean;

  // Actions
  handleDateConfirm: (date: Date) => void;
  handleDateCancel: () => void;
  handleOpenDatePicker: (index: number) => void;
  handleOpenContactPicker: (index: number) => void;
  handleSelectContact: (contact: Contacts.Contact) => void;
  handleContactPickerCancel: () => void;
  handleAddToCalendar: (index: number, item: ActionItem) => void;
  setContactSearchQuery: (query: string) => void;
  setShowCalendarDialog: (show: boolean) => void;
  setSavedActionIndex: (index: number | null) => void;
}

export function useActionItems(): UseActionItemsReturn {
  // Read everything from stores - autonomous hook
  const capture = useCaptureDetailStore((state) => state.capture);
  const toast = useToast();

  const captureId = capture?.id || "";

  // Get action items analysis from store
  const { analyses } = useCurrentAnalyses(captureId);
  const actionItemsAnalysis = analyses[ANALYSIS_TYPES.ACTION_ITEMS];
  const setAnalysis = useAnalysesStore((state) => state.setAnalysis);

  // Get action items state from store
  const {
    actionItems,
    showDatePicker,
    showContactPicker,
    showCalendarDialog,
    selectedDate,
    editingActionIndex,
    savingActionIndex,
    savedActionIndex,
    addingToCalendarIndex,
    addedToCalendarIndex,
    contacts,
    contactSearchQuery,
    loadingContacts,
  } = useCurrentActionItems(captureId);

  // Store setters
  const setActionItemsInStore = useActionItemsStore((state) => state.setActionItems);
  const setShowDatePicker = useActionItemsStore((state) => state.setShowDatePicker);
  const setShowContactPicker = useActionItemsStore((state) => state.setShowContactPicker);
  const setShowCalendarDialog = useActionItemsStore((state) => state.setShowCalendarDialog);
  const setSelectedDate = useActionItemsStore((state) => state.setSelectedDate);
  const setEditingActionIndex = useActionItemsStore((state) => state.setEditingActionIndex);
  const setSavingActionIndex = useActionItemsStore((state) => state.setSavingActionIndex);
  const setSavedActionIndex = useActionItemsStore((state) => state.setSavedActionIndex);
  const setAddingToCalendarIndex = useActionItemsStore((state) => state.setAddingToCalendarIndex);
  const setAddedToCalendarIndex = useActionItemsStore((state) => state.setAddedToCalendarIndex);
  const setContacts = useActionItemsStore((state) => state.setContacts);
  const setContactSearchQuery = useActionItemsStore((state) => state.setContactSearchQuery);
  const setLoadingContacts = useActionItemsStore((state) => state.setLoadingContacts);

  // Sync action items when analysis changes
  useEffect(() => {
    if (actionItemsAnalysis) {
      const parsed = parseActionItems(actionItemsAnalysis.content);
      setActionItemsInStore(captureId, parsed);
    }
  }, [actionItemsAnalysis, captureId, setActionItemsInStore]);

  // Save action items to database
  const saveActionItems = async (items: ActionItem[], itemIndex: number) => {
    setSavingActionIndex(captureId, itemIndex);
    setSavedActionIndex(captureId, null);

    try {
      const analysisRepository = container.resolve<ICaptureAnalysisRepository>(
        TOKENS.ICaptureAnalysisRepository,
      );
      const content = JSON.stringify({ items });

      await analysisRepository.save({
        captureId,
        analysisType: ANALYSIS_TYPES.ACTION_ITEMS,
        content,
        modelId: actionItemsAnalysis?.modelId || undefined,
        processingDurationMs: actionItemsAnalysis?.processingDurationMs || undefined,
      });

      // Update analysis in store
      if (actionItemsAnalysis) {
        setAnalysis(captureId, ANALYSIS_TYPES.ACTION_ITEMS, {
          ...actionItemsAnalysis,
          content,
          updatedAt: new Date(),
        });
      }

      console.log("[useActionItems] Action items saved");

      // Show saved indicator
      setSavingActionIndex(captureId, null);
      setSavedActionIndex(captureId, itemIndex);
    } catch (error) {
      console.error("[useActionItems] Failed to save action items:", error);
      setSavingActionIndex(captureId, null);
    }
  };

  // Handler to open date picker
  const handleOpenDatePicker = (index: number) => {
    setEditingActionIndex(captureId, index);
    if (actionItems?.[index]?.deadline_date) {
      const match = actionItems[index].deadline_date!.match(
        /^(\d{2})-(\d{2})-(\d{4}),?\s*(\d{2}):(\d{2})$/,
      );
      if (match) {
        const [, day, month, year, hours, minutes] = match;
        setSelectedDate(
          captureId,
          new Date(
            parseInt(year, 10),
            parseInt(month, 10) - 1,
            parseInt(day, 10),
            parseInt(hours, 10),
            parseInt(minutes, 10),
          ),
        );
      } else {
        setSelectedDate(captureId, new Date());
      }
    } else {
      setSelectedDate(captureId, new Date());
    }
    setShowDatePicker(captureId, true);
  };

  // Handler for date confirmation
  const handleDateConfirm = (date: Date) => {
    if (editingActionIndex !== null && actionItems) {
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const dateStr = `${day}-${month}-${year}, ${hours}:${minutes}`;

      const updatedItems = [...actionItems];
      updatedItems[editingActionIndex] = {
        ...updatedItems[editingActionIndex],
        deadline_date: dateStr,
        deadline_text: null, // Clear text when a specific date is set
      };
      setActionItemsInStore(captureId, updatedItems);
      setSelectedDate(captureId, date);

      // Auto-save
      saveActionItems(updatedItems, editingActionIndex);
    }
    setShowDatePicker(captureId, false);
    setEditingActionIndex(captureId, null);
  };

  // Handler for date picker cancel
  const handleDateCancel = () => {
    setShowDatePicker(captureId, false);
    setEditingActionIndex(captureId, null);
  };

  // Handler to open contact picker
  const handleOpenContactPicker = async (index: number) => {
    setEditingActionIndex(captureId, index);
    setContactSearchQuery(captureId, "");
    setLoadingContacts(captureId, true);
    setShowContactPicker(captureId, true);

    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        toast.warning(
          "L'accès aux contacts est nécessaire pour cette fonctionnalité",
        );
        setShowContactPicker(captureId, false);
        setLoadingContacts(captureId, false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
        ],
        sort: Contacts.SortTypes.FirstName,
      });

      setContacts(captureId, data);
    } catch (error) {
      console.error("[useActionItems] Failed to load contacts:", error);
      toast.error("Impossible de charger les contacts");
      setShowContactPicker(captureId, false);
    } finally {
      setLoadingContacts(captureId, false);
    }
  };

  // Handler for contact selection
  const handleSelectContact = (contact: Contacts.Contact) => {
    if (editingActionIndex !== null && actionItems) {
      const currentIndex = editingActionIndex;
      const updatedItems = [...actionItems];
      updatedItems[currentIndex] = {
        ...updatedItems[currentIndex],
        target: contact.name || "Contact sans nom",
      };
      setActionItemsInStore(captureId, updatedItems);

      // Auto-save
      saveActionItems(updatedItems, currentIndex);
    }
    setShowContactPicker(captureId, false);
    setEditingActionIndex(captureId, null);
    setContactSearchQuery(captureId, "");
  };

  // Handler for contact picker cancel
  const handleContactPickerCancel = () => {
    setShowContactPicker(captureId, false);
    setEditingActionIndex(captureId, null);
    setContactSearchQuery(captureId, "");
  };

  // Handler for adding action item to Google Calendar
  const handleAddToCalendar = async (index: number, item: ActionItem) => {
    if (!item.deadline_date) return;

    // Check if Google is connected
    const isConnected = await GoogleCalendarService.isConnected();

    if (!isConnected) {
      setShowCalendarDialog(captureId, true);
      return;
    }

    setAddingToCalendarIndex(captureId, index);
    setAddedToCalendarIndex(captureId, null);

    try {
      // Parse the date from "JJ-MM-AAAA, HH:mm" format
      const match = item.deadline_date.match(
        /^(\d{2})-(\d{2})-(\d{4}),?\s*(\d{2}):(\d{2})$/,
      );
      if (!match) {
        toast.error("Format de date invalide");
        setAddingToCalendarIndex(null);
        return;
      }

      const [, day, month, year, hours, minutes] = match;
      const startDate = new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hours, 10),
        parseInt(minutes, 10),
      );

      const result = await GoogleCalendarService.createEvent({
        summary: item.title,
        description: item.target ? `Pour: ${item.target}` : undefined,
        startDateTime: startDate,
      });

      if (result.success) {
        setAddingToCalendarIndex(captureId, null);
        setAddedToCalendarIndex(captureId, index);

        // Clear indicator after 2 seconds
        setTimeout(() => {
          setAddedToCalendarIndex(captureId, null);
        }, 2000);
      } else {
        toast.error(result.error || "Impossible de créer l'événement");
        setAddingToCalendarIndex(captureId, null);
      }
    } catch (error) {
      console.error("[useActionItems] Add to calendar error:", error);
      toast.error("Impossible de créer l'événement");
      setAddingToCalendarIndex(captureId, null);
    }
  };

  // Filter contacts based on search query
  const filteredContacts = contacts.filter((contact) => {
    if (!contactSearchQuery) return true;
    const name = contact.name?.toLowerCase() || "";
    return name.includes(contactSearchQuery.toLowerCase());
  });

  return {
    // State
    actionItems,
    savingActionIndex,
    savedActionIndex,
    editingActionIndex,
    addedToCalendarIndex,
    addingToCalendarIndex,
    showDatePicker,
    showContactPicker,
    selectedDate,
    contacts,
    contactSearchQuery,
    loadingContacts,
    filteredContacts,
    showCalendarDialog,

    // Actions
    handleDateConfirm,
    handleDateCancel,
    handleOpenDatePicker,
    handleOpenContactPicker,
    handleSelectContact,
    handleContactPickerCancel,
    handleAddToCalendar,
    setContactSearchQuery,
    setShowCalendarDialog,
    setSavedActionIndex,
  };
}
