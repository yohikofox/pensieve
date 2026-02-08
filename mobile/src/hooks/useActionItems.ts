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

import { useEffect, useRef } from "react";
import * as Contacts from "expo-contacts";
import { container } from "tsyringe";
import { v4 as uuidv4 } from "uuid";
import { useQueryClient } from "@tanstack/react-query";
import { TOKENS } from "../infrastructure/di/tokens";
import type { ICaptureAnalysisRepository } from "../contexts/capture/domain/ICaptureAnalysisRepository";
import type { IThoughtRepository } from "../contexts/knowledge/domain/IThoughtRepository";
import type { ITodoRepository } from "../contexts/action/domain/ITodoRepository";
import type { IAnalysisTodoRepository } from "../contexts/action/domain/IAnalysisTodoRepository";
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

/**
 * Parse "JJ-MM-AAAA, HH:mm" deadline string to Unix timestamp (ms)
 */
function parseDeadlineToTimestamp(deadlineDate: string): number | undefined {
  const match = deadlineDate.match(/^(\d{2})-(\d{2})-(\d{4}),?\s*(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const [, day, month, year, hours, minutes] = match;
  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hours, 10),
    parseInt(minutes, 10),
  ).getTime();
}

/**
 * Sync parsed action items to the todos table for display in Actions tab.
 * Idempotent: deletes todos linked to the analysis before re-creating.
 */
async function syncActionItemsToTodos(
  items: ActionItem[],
  captureId: string,
  analyses: Record<string, any>,
): Promise<void> {
  const thoughtRepo = container.resolve<IThoughtRepository>(TOKENS.IThoughtRepository);
  const todoRepo = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);
  const analysisTodoRepo = container.resolve<IAnalysisTodoRepository>(TOKENS.IAnalysisTodoRepository);
  const captureAnalysisRepo = container.resolve<ICaptureAnalysisRepository>(TOKENS.ICaptureAnalysisRepository);

  // 1. Get the analysis record to obtain its ID
  const analysis = await captureAnalysisRepo.get(captureId, ANALYSIS_TYPES.ACTION_ITEMS);
  if (!analysis) {
    console.warn('[useActionItems] No action_items analysis found for capture', captureId);
    return;
  }

  // 2. Find or create a Thought for this capture
  let thought = await thoughtRepo.findByCaptureId(captureId);

  if (!thought) {
    const summaryAnalysis = analyses[ANALYSIS_TYPES.SUMMARY];
    const summary = summaryAnalysis?.content || 'Action items capture';

    const now = Date.now();
    thought = {
      id: uuidv4(),
      captureId,
      userId: 'local',
      summary,
      processingTimeMs: 0,
      createdAt: now,
      updatedAt: now,
    };
    await thoughtRepo.create(thought);
  }

  // 3. Delete existing todos linked to this analysis for idempotency
  await analysisTodoRepo.deleteByAnalysisId(analysis.id);

  // 4. Create a Todo per ActionItem and link it to the analysis
  const now = Date.now();
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const deadline = item.deadline_date
      ? parseDeadlineToTimestamp(item.deadline_date)
      : undefined;

    const todoId = uuidv4();
    await todoRepo.create({
      id: todoId,
      thoughtId: thought.id,
      captureId,
      userId: 'local',
      description: item.title,
      status: 'todo',
      deadline,
      contact: item.target ?? undefined,
      priority: 'medium',
      createdAt: now,
      updatedAt: now,
    });

    await analysisTodoRepo.link(todoId, analysis.id, index);
  }

  console.log(`[useActionItems] Synced ${items.length} action items to todos for capture ${captureId}`);
}

/**
 * Convert Unix timestamp (ms) to "JJ-MM-AAAA, HH:mm" deadline string
 */
function timestampToDeadlineDate(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day}-${month}-${year}, ${hours}:${minutes}`;
}

/**
 * Convert a Todo entity to an ActionItem for display
 */
function todoToActionItem(todo: import("../contexts/action/domain/Todo.model").Todo): ActionItem {
  return {
    title: todo.description,
    deadline_date: todo.deadline ? timestampToDeadlineDate(todo.deadline) : null,
    deadline_text: null,
    target: todo.contact ?? null,
  };
}

/**
 * Load action items from todos DB (source of truth after sync)
 */
export async function loadActionItemsFromTodos(captureId: string): Promise<ActionItem[] | null> {
  const captureAnalysisRepo = container.resolve<ICaptureAnalysisRepository>(TOKENS.ICaptureAnalysisRepository);
  const todoRepo = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);

  const analysis = await captureAnalysisRepo.get(captureId, ANALYSIS_TYPES.ACTION_ITEMS);
  if (!analysis) return null;

  const todos = await todoRepo.findByAnalysisId(analysis.id);
  if (todos.length === 0) return null;

  return todos.map(todoToActionItem);
}

/**
 * Update the corresponding Todo when an ActionItem is edited (date or contact).
 */
async function updateTodoFromActionItem(
  captureId: string,
  actionItemIndex: number,
  changes: Partial<{ deadline: number; contact: string }>,
): Promise<void> {
  const captureAnalysisRepo = container.resolve<ICaptureAnalysisRepository>(TOKENS.ICaptureAnalysisRepository);
  const analysisTodoRepo = container.resolve<IAnalysisTodoRepository>(TOKENS.IAnalysisTodoRepository);
  const todoRepo = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);

  const analysis = await captureAnalysisRepo.get(captureId, ANALYSIS_TYPES.ACTION_ITEMS);
  if (!analysis) {
    console.warn('[useActionItems] updateTodoFromActionItem: no analysis found for capture', captureId);
    return;
  }

  const todoId = await analysisTodoRepo.findTodoIdByAnalysisAndIndex(analysis.id, actionItemIndex);
  if (!todoId) {
    console.warn('[useActionItems] updateTodoFromActionItem: no todo found for analysis', analysis.id, 'index', actionItemIndex);
    return;
  }

  await todoRepo.update(todoId, changes);
}

export function useActionItems(): UseActionItemsReturn {
  const toast = useToast();
  const queryClient = useQueryClient();
  const syncInProgressRef = useRef(false);

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
    if (actionItemsAnalysis && captureId) {
      // Instant display from parsed JSON
      const parsed = parseActionItems(actionItemsAnalysis.content);
      setActionItemsInStore(parsed);

      if (parsed && parsed.length > 0 && !syncInProgressRef.current) {
        syncInProgressRef.current = true;

        // Try loading from DB first (source of truth for edits)
        loadActionItemsFromTodos(captureId)
          .then(async (dbItems) => {
            if (dbItems && dbItems.length > 0) {
              // Todos already exist → use DB values (reflects edits from Actions tab)
              setActionItemsInStore(dbItems);
            } else {
              // No todos yet → sync from JSON then reload from DB
              await syncActionItemsToTodos(parsed, captureId, analyses);
              const freshItems = await loadActionItemsFromTodos(captureId);
              if (freshItems && freshItems.length > 0) {
                setActionItemsInStore(freshItems);
              }
              queryClient.invalidateQueries({ queryKey: ['todos'] });
            }
          })
          .catch((error) => {
            console.error('[useActionItems] Failed to sync action items to todos:', error);
          })
          .finally(() => {
            syncInProgressRef.current = false;
          });
      }
    } else if (actionItemsAnalysis) {
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

      // Sync deadline change to the corresponding Todo
      if (captureId) {
        updateTodoFromActionItem(captureId, editingActionIndex, { deadline: date.getTime() })
          .then(() => queryClient.invalidateQueries({ queryKey: ['todos'] }))
          .catch((err) => console.error('[useActionItems] Failed to sync deadline to todo:', err));
      }
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

      // Sync contact change to the corresponding Todo
      if (captureId) {
        const contactName = contact.name || "Contact sans nom";
        updateTodoFromActionItem(captureId, currentIndex, { contact: contactName })
          .then(() => queryClient.invalidateQueries({ queryKey: ['todos'] }))
          .catch((err) => console.error('[useActionItems] Failed to sync contact to todo:', err));
      }
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
