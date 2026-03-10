/**
 * useRevokePat — Révocation d'un Personal Access Token
 * Story 27.2 — DELETE /api/auth/pat/:id
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { AuthTokenManager } from '../../infrastructure/auth/AuthTokenManager';
import { apiConfig } from '../../config/api';
import { RepositoryResultType } from '../../contexts/shared/domain/Result';
import { PAT_LIST_QUERY_KEY } from './usePatList';

export const useRevokePat = () => {
  const queryClient = useQueryClient();
  const tokenManager = container.resolve(AuthTokenManager);

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const tokenResult = await tokenManager.getValidToken();
      if (tokenResult.type !== RepositoryResultType.SUCCESS) throw new Error('Not authenticated');

      const response = await fetch(apiConfig.endpoints.pat.revoke(id), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenResult.data}` },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAT_LIST_QUERY_KEY });
    },
  });
};
