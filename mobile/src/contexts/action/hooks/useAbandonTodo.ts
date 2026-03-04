/**
 * useAbandonTodo Hook
 * Story 8.14 — AC1, AC3: Abandon a todo (soft state, preserves history)
 */

import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { container } from 'tsyringe';
import { ITodoRepository } from '../domain/ITodoRepository';
import { TOKENS } from '../../../infrastructure/di/tokens';
import { useSettingsStore } from '../../../stores/settingsStore';

/**
 * Abandon a single todo (transition to status = 'abandoned')
 * No confirmation dialog — abandon is reversible (unlike delete)
 *
 * @returns React Query mutation
 */
export const useAbandonTodo = (): UseMutationResult<void, Error, string> => {
  const queryClient = useQueryClient();
  const hapticFeedbackEnabled = useSettingsStore((state) => state.hapticFeedbackEnabled);
  const todoRepository = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);

  return useMutation({
    mutationFn: async (todoId: string) => {
      const result = await todoRepository.update(todoId, {
        status: 'abandoned',
      });
      if (result === false) {
        throw new Error('Update returned false — no changes or todo not found');
      }
    },

    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      if (hapticFeedbackEnabled) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    },

    onError: (err) => {
      console.error('[useAbandonTodo] Error abandoning todo:', err);
      Alert.alert(
        'Erreur',
        'Impossible d\'abandonner la tâche. Veuillez réessayer.',
        [{ text: 'OK', style: 'default' }],
      );
    },
  });
};
