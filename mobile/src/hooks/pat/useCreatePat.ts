/**
 * useCreatePat — Création d'un Personal Access Token
 * Story 27.2 — POST /api/auth/pat
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { AuthTokenManager } from '../../infrastructure/auth/AuthTokenManager';
import { apiConfig } from '../../config/api';
import { RepositoryResultType } from '../../contexts/shared/domain/Result';
import type { CreatePatDto, PatWithToken } from './types';
import { PAT_LIST_QUERY_KEY } from './usePatList';

export const useCreatePat = () => {
  const queryClient = useQueryClient();
  const tokenManager = container.resolve(AuthTokenManager);

  return useMutation<PatWithToken, Error, CreatePatDto>({
    mutationFn: async (dto) => {
      const tokenResult = await tokenManager.getValidToken();
      if (tokenResult.type !== RepositoryResultType.SUCCESS) throw new Error('Not authenticated');

      const response = await fetch(apiConfig.endpoints.pat.create, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenResult.data}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dto),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAT_LIST_QUERY_KEY });
    },
  });
};
