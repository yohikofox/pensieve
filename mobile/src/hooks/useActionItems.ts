/**
 * useActionItems Hook
 *
 * Autonomous hook for action items management.
 * Reads/writes to unified captureDetailStore.
 *
 * Manages action items lifecycle:
 * - Parsing from LLM analysis
 * - CRUD operations (update, save)
 * - Date picking
 * - Contact selection
 * - Google Calendar integration
 *
 * Story 5.4 - Unified store: no more captureId indexing
 */

import { useEffect } from "react";
import * as Contacts from "expo-contacts";
import { container } from "tsyringe";
import { TOKENS } from "../infrastructure/di/tokens";
import type { ICaptureAnalysisRepository } from "../contexts/capture/domain/ICaptureAnalysisRepository";
import { ANALYSIS_TYPES } from "../contexts/capture/domain/CaptureAnalysis.model";
import {
  parseActionItems,
  type ActionItem,
} from "../contexts/capture/utils/actionItemParser";
import { GoogleCalendarService } from "../services/GoogleCalendarService";
import { useToast } from "../design-system/components";
import { useCaptureDetailStore } from "../stores/captureDetailStore";

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
  const toast = useToast();

  // Read from unified store - direct selectors
  const captureId = useCaptureDetailStore((state) => state.captureId);
  const analyses = useCaptureDetailStore((state) => state.analyses);
  const actionItemsAnalysis = analyses[ANALYSIS_TYPES.ACTION_ITEMS];

  // Action items state
  const actionItems = useCaptureDetailStore((state) => state.actionItems);
  const showDatePicker = useCaptureDetailStore((state) => state.showDatePicker);
  const showContactPicker = useCaptureDetailStore((state) => state.showContactPicker);
  const showCalendarDialog = useCaptureDetailStore((state) => state.showCalendarDialog);
  const selectedDate = useCaptureDetailStore((state) => state.selectedDate);
  const editingActionIndex = useCaptureDetailStore((state) => state.editingActionIndex);
  const savingActionIndex = useCaptureDetailStore((state) => state.savingActionIndex);
  const savedActionIndex = useCaptureDetailStore((state) => state.savedActionIndex);
  const addingToCalendarIndex = useCaptureDetailStore((state) => state.addingToCalendarIndex);
  const addedToCalendarIndex = useCaptureDetailStore((state) => state.addedToCalendarIndex);
  const contacts = useCaptureDetailStore((state) => state.contacts);
  const contactSearchQuery = useCaptureDetailStore((state) => state.contactSearchQuery);
  const loadingContacts = useCaptureDetailStore((state) => state.loadingContacts);

  // Store setters
  const setActionItemsInStore = useCaptureDetailStore((state) => state.setActionItems);
  const setShowDatePicker = useCaptureDetailStore((state) => state.setShowDatePicker);
  const setShowContactPicker = useCaptureDetailStore((state) => state.setShowContactPicker);
  const setShowCalendarDialog = useCaptureDetailStore((state) => state.setShowCalendarDialog);
  const setSelectedDate = useCaptureDetailStore((state) => state.setSelectedDate);
  const setEditingActionIndex = useCaptureDetailStore((state) => state.setEditingActionIndex);
  const setSavingActionIndex = useCaptureDetailStore((state) => state.setSavingActionIndex);
  const setSavedActionIndex = useCaptureDetailStore((state) => state.setSavedActionIndex);
  const setAddingToCalendarIndex = useCaptureDetailStore((state) => state.setAddingToCalendarIndex);
  const setAddedToCalendarIndex = useCaptureDetailStore((state) => state.setAddedToCalendarIndex);
  const setContacts = useCaptureDetailStore((state) => state.setContacts);
  const setContactSearchQueryInStore = useCaptureDetailStore((state) => state.setContactSearchQuery);
  const setLoadingContacts = useCaptureDetailStore((state) => state.setLoadingContacts);
  const setAnalysis = useCaptureDetailStore((state) => state.setAnalysis);

  // Sync action items when analysis changes
  useEffect(() => {
    if (actionItemsAnalysis) {
      const parsed = parseActionItems(actionItemsAnalysis.content);
      setActionItemsInStore(parsed);
    }
  }, [actionItemsAnalysis, setActionItemsInStore]);

  // Save action items to database
  const saveActionItems = async (items: ActionItem[], itemIndex: number) => {
    if (!captureId) return;

    setSavingActionIndex(itemIndex);
    setSavedActionIndex(null);

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
        setAnalysis(ANALYSIS_TYPES.ACTION_ITEMS, {
          ...actionItemsAnalysis,
          content,
          updatedAt: new Date(),
        });
      }

      console.log("[useActionItems] Action items saved");

      setSavingActionIndex(null);
      setSavedActionIndex(itemIndex);
    } catch (error) {
      console.error("[useActionItems] Failed to save action items:", error);
      setSavingActionIndex(null);
    }
  };

  // Handler to open date picker
  const handleOpenDatePicker = (index: number) => {
    setEditingActionIndex(index);
    if (actionItems?.[index]?.deadline_date) {
      const match = actionItems[index].deadline_date!.match(
        /^(\d{2})-(\d{2})-(\d{4}),?\s*(\d{2}):(\d{2})$/,
      );
      if (match) {
        const [, day, month, year, hours, minutes] = match;
        setSelectedDate(
          new Date(
            parseInt(year, 10),
            parseInt(month, 10) - 1,
            parseInt(day, 10),
            parseInt(hours, 10),
            parseInt(minutes, 10),
          ),
        );
      } else {
        setSelectedDate(new Date());
      }
    } else {
      setSelectedDate(new Date());
    }
    setShowDatePicker(true);
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
        deadline_text: null,
      };
      setActionItemsInStore(updatedItems);
      setSelectedDate(date);

      saveActionItems(updatedItems, editingActionIndex);
    }
    setShowDatePicker(false);
    setEditingActionIndex(null);
  };

  // Handler for date picker cancel
  const handleDateCancel = () => {
    setShowDatePicker(false);
    setEditingActionIndex(null);
  };

  // Handler to open contact picker
  const handleOpenContactPicker = async (index: number) => {
    setEditingActionIndex(index);
    setContactSearchQueryInStore("");
    setLoadingContacts(true);
    setShowContactPicker(true);

    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        toast.warning(
          "L'accès aux contacts est nécessaire pour cette fonctionnalité",
        );
        setShowContactPicker(false);
        setLoadingContacts(false);
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

      setContacts(data);
    } catch (error) {
      console.error("[useActionItems] Failed to load contacts:", error);
      toast.error("Impossible de charger les contacts");
      setShowContactPicker(false);
    } finally {
      setLoadingContacts(false);
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
      setActionItemsInStore(updatedItems);

      saveActionItems(updatedItems, currentIndex);
    }
    setShowContactPicker(false);
    setEditingActionIndex(null);
    setContactSearchQueryInStore("");
  };

  // Handler for contact picker cancel
  const handleContactPickerCancel = () => {
    setShowContactPicker(false);
    setEditingActionIndex(null);
    setContactSearchQueryInStore("");
  };

  // Handler for adding action item to Google Calendar
  const handleAddToCalendar = async (index: number, item: ActionItem) => {
    if (!item.deadline_date) return;

    const isConnected = await GoogleCalendarService.isConnected();

    if (!isConnected) {
      setShowCalendarDialog(true);
      return;
    }

    setAddingToCalendarIndex(index);
    setAddedToCalendarIndex(null);

    try {
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
        setAddingToCalendarIndex(null);
        setAddedToCalendarIndex(index);

        setTimeout(() => {
          setAddedToCalendarIndex(null);
        }, 2000);
      } else {
        toast.error(result.error || "Impossible de créer l'événement");
        setAddingToCalendarIndex(null);
      }
    } catch (error) {
      console.error("[useActionItems] Add to calendar error:", error);
      toast.error("Impossible de créer l'événement");
      setAddingToCalendarIndex(null);
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
    setContactSearchQuery: setContactSearchQueryInStore,
    setShowCalendarDialog,
    setSavedActionIndex,
  };
}
