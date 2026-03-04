/**
 * useAbandonTodo Hook
 * Story 8.14 — AC1, AC3: Abandon a todo (soft state, preserves history)
 * Story 8.23 — Refactored: delegate to useTodoDetailStore (ADR-038 + ADR-031)
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { RepositoryResultType } from '../../../contexts/shared/domain/Result';
import { useTodoDetailStore } from '../../../stores/useTodoDetailStore';
import { useTodosListStore } from '../../../stores/useTodosListStore';
import { useSettingsStore } from '../../../stores/settingsStore';

/**
 * Abandon a single todo (transition to status = 'abandoned')
 * No confirmation dialog — abandon is reversible (unlike delete)
 *
 * Délègue à useTodoDetailStore.abandon() qui appelle :
 *   entity.abandon() → repo.save(entity) → onMutationCallback
 *
 * @returns mutate function (todoId: string) → Promise<void>
 */
export const useAbandonTodo = () => {
  const hapticFeedbackEnabled = useSettingsStore((state) => state.hapticFeedbackEnabled);

  const mutate = useCallback(async (todoId: string): Promise<void> => {
    const detailStore = useTodoDetailStore.getState();
    const listStore = useTodosListStore.getState();

    // Charger le todo si nécessaire
    if (detailStore.todoId !== todoId) {
      await detailStore.load(todoId);
    }

    // Enregistrer le callback vers le List Store
    detailStore.setOnMutationCallback((id) => listStore.onMutation(id));

    // Déléguer la mutation au store (ADR-031 : règle métier sur l'entité)
    const result = await detailStore.abandon();

    if (result.type === RepositoryResultType.SUCCESS) {
      if (hapticFeedbackEnabled) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } else {
      console.error('[useAbandonTodo] Error abandoning todo:', result.error);
      Alert.alert(
        'Erreur',
        'Impossible d\'abandonner la tâche. Veuillez réessayer.',
        [{ text: 'OK', style: 'default' }],
      );
    }
  }, [hapticFeedbackEnabled]);

  return { mutate };
};
