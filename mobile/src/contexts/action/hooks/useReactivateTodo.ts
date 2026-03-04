/**
 * useReactivateTodo Hook
 * Story 8.14 — AC5: Reactivate an abandoned todo (back to status = 'todo')
 */

import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { container } from 'tsyringe';
import { ITodoRepository } from '../domain/ITodoRepository';
import { TOKENS } from '../../../infrastructure/di/tokens';
import { useSettingsStore } from '../../../stores/settingsStore';

/**
 * Reactivate an abandoned todo (transition to status = 'todo')
 *
 * @returns React Query mutation
 */
export const useReactivateTodo = (): UseMutationResult<void, Error, string> => {
  const queryClient = useQueryClient();
  const hapticFeedbackEnabled = useSettingsStore((state) => state.hapticFeedbackEnabled);
  const todoRepository = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);

  return useMutation({
    mutationFn: async (todoId: string) => {
      const result = await todoRepository.update(todoId, {
        status: 'todo',
      });
      if (result === false) {
        throw new Error('Update returned false — no changes or todo not found');
      }
    },

    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      if (hapticFeedbackEnabled) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },

    onError: (err) => {
      console.error('[useReactivateTodo] Error reactivating todo:', err);
      Alert.alert(
        'Erreur',
        'Impossible de réactiver la tâche. Veuillez réessayer.',
        [{ text: 'OK', style: 'default' }],
      );
    },
  });
};
