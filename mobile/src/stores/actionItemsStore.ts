/**
 * ActionItemsStore
 *
 * Zustand store managing the state of action items for the current capture
 * Allows multiple hooks and components to share action items state
 */

import { create } from "zustand";
import type { ActionItem } from "../contexts/capture/utils/actionItemParser";
import * as Contacts from "expo-contacts";

interface ActionItemsState {
  // Action items data per capture
  actionItems: Record<string, ActionItem[] | null>;

  // UI states per capture
  showDatePicker: Record<string, boolean>;
  showContactPicker: Record<string, boolean>;
  showCalendarDialog: Record<string, boolean>;

  // Selected state per capture
  selectedDate: Record<string, Date>;
  editingActionIndex: Record<string, number | null>;

  // Saving state per capture
  savingActionIndex: Record<string, number | null>;
  savedActionIndex: Record<string, number | null>;
  addingToCalendarIndex: Record<string, number | null>;
  addedToCalendarIndex: Record<string, number | null>;

  // Contact state per capture
  contacts: Record<string, Contacts.Contact[]>;
  contactSearchQuery: Record<string, string>;
  loadingContacts: Record<string, boolean>;

  // Actions
  setActionItems: (captureId: string, items: ActionItem[] | null) => void;
  setShowDatePicker: (captureId: string, show: boolean) => void;
  setShowContactPicker: (captureId: string, show: boolean) => void;
  setShowCalendarDialog: (captureId: string, show: boolean) => void;
  setSelectedDate: (captureId: string, date: Date) => void;
  setEditingActionIndex: (captureId: string, index: number | null) => void;
  setSavingActionIndex: (captureId: string, index: number | null) => void;
  setSavedActionIndex: (captureId: string, index: number | null) => void;
  setAddingToCalendarIndex: (captureId: string, index: number | null) => void;
  setAddedToCalendarIndex: (captureId: string, index: number | null) => void;
  setContacts: (captureId: string, contacts: Contacts.Contact[]) => void;
  setContactSearchQuery: (captureId: string, query: string) => void;
  setLoadingContacts: (captureId: string, loading: boolean) => void;
  reset: (captureId: string) => void;
}

const initialState = {
  actionItems: null,
  showDatePicker: false,
  showContactPicker: false,
  showCalendarDialog: false,
  selectedDate: new Date(),
  editingActionIndex: null,
  savingActionIndex: null,
  savedActionIndex: null,
  addingToCalendarIndex: null,
  addedToCalendarIndex: null,
  contacts: [] as Contacts.Contact[],
  contactSearchQuery: "",
  loadingContacts: false,
};

export const useActionItemsStore = create<ActionItemsState>((set) => ({
  actionItems: {},
  showDatePicker: {},
  showContactPicker: {},
  showCalendarDialog: {},
  selectedDate: {},
  editingActionIndex: {},
  savingActionIndex: {},
  savedActionIndex: {},
  addingToCalendarIndex: {},
  addedToCalendarIndex: {},
  contacts: {},
  contactSearchQuery: {},
  loadingContacts: {},

  setActionItems: (captureId, items) =>
    set((state) => ({
      actionItems: {
        ...state.actionItems,
        [captureId]: items,
      },
    })),

  setShowDatePicker: (captureId, show) =>
    set((state) => ({
      showDatePicker: {
        ...state.showDatePicker,
        [captureId]: show,
      },
    })),

  setShowContactPicker: (captureId, show) =>
    set((state) => ({
      showContactPicker: {
        ...state.showContactPicker,
        [captureId]: show,
      },
    })),

  setShowCalendarDialog: (captureId, show) =>
    set((state) => ({
      showCalendarDialog: {
        ...state.showCalendarDialog,
        [captureId]: show,
      },
    })),

  setSelectedDate: (captureId, date) =>
    set((state) => ({
      selectedDate: {
        ...state.selectedDate,
        [captureId]: date,
      },
    })),

  setEditingActionIndex: (captureId, index) =>
    set((state) => ({
      editingActionIndex: {
        ...state.editingActionIndex,
        [captureId]: index,
      },
    })),

  setSavingActionIndex: (captureId, index) =>
    set((state) => ({
      savingActionIndex: {
        ...state.savingActionIndex,
        [captureId]: index,
      },
    })),

  setSavedActionIndex: (captureId, index) =>
    set((state) => ({
      savedActionIndex: {
        ...state.savedActionIndex,
        [captureId]: index,
      },
    })),

  setAddingToCalendarIndex: (captureId, index) =>
    set((state) => ({
      addingToCalendarIndex: {
        ...state.addingToCalendarIndex,
        [captureId]: index,
      },
    })),

  setAddedToCalendarIndex: (captureId, index) =>
    set((state) => ({
      addedToCalendarIndex: {
        ...state.addedToCalendarIndex,
        [captureId]: index,
      },
    })),

  setContacts: (captureId, contacts) =>
    set((state) => ({
      contacts: {
        ...state.contacts,
        [captureId]: contacts,
      },
    })),

  setContactSearchQuery: (captureId, query) =>
    set((state) => ({
      contactSearchQuery: {
        ...state.contactSearchQuery,
        [captureId]: query,
      },
    })),

  setLoadingContacts: (captureId, loading) =>
    set((state) => ({
      loadingContacts: {
        ...state.loadingContacts,
        [captureId]: loading,
      },
    })),

  reset: (captureId) =>
    set((state) => {
      const newState = { ...state };
      Object.keys(initialState).forEach((key) => {
        if (newState[key as keyof ActionItemsState]) {
          const stateObj = newState[key as keyof ActionItemsState] as Record<string, any>;
          delete stateObj[captureId];
        }
      });
      return newState;
    }),
}));

/**
 * Hook to get current capture's action items state
 */
export const useCurrentActionItems = (captureId: string) => {
  const actionItems = useActionItemsStore(
    (state) => state.actionItems[captureId] || null
  );
  const showDatePicker = useActionItemsStore(
    (state) => state.showDatePicker[captureId] ?? false
  );
  const showContactPicker = useActionItemsStore(
    (state) => state.showContactPicker[captureId] ?? false
  );
  const showCalendarDialog = useActionItemsStore(
    (state) => state.showCalendarDialog[captureId] ?? false
  );
  const selectedDate = useActionItemsStore(
    (state) => state.selectedDate[captureId] || new Date()
  );
  const editingActionIndex = useActionItemsStore(
    (state) => state.editingActionIndex[captureId] || null
  );
  const savingActionIndex = useActionItemsStore(
    (state) => state.savingActionIndex[captureId] || null
  );
  const savedActionIndex = useActionItemsStore(
    (state) => state.savedActionIndex[captureId] || null
  );
  const addingToCalendarIndex = useActionItemsStore(
    (state) => state.addingToCalendarIndex[captureId] || null
  );
  const addedToCalendarIndex = useActionItemsStore(
    (state) => state.addedToCalendarIndex[captureId] || null
  );
  const contacts = useActionItemsStore(
    (state) => state.contacts[captureId] || []
  );
  const contactSearchQuery = useActionItemsStore(
    (state) => state.contactSearchQuery[captureId] || ""
  );
  const loadingContacts = useActionItemsStore(
    (state) => state.loadingContacts[captureId] ?? false
  );

  return {
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
  };
};
