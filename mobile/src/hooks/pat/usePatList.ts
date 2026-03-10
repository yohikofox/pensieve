/**
 * usePatList — Liste des Personal Access Tokens
 * Story 27.2 — GET /api/auth/pat
 */

import { useQuery } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { AuthTokenManager } from '../../infrastructure/auth/AuthTokenManager';
import { apiConfig } from '../../config/api';
import { RepositoryResultType } from '../../contexts/shared/domain/Result';
import type { Pat } from './types';

export const PAT_LIST_QUERY_KEY = ['pat', 'list'];

export const usePatList = () => {
  const tokenManager = container.resolve(AuthTokenManager);

  return useQuery<Pat[]>({
    queryKey: PAT_LIST_QUERY_KEY,
    queryFn: async () => {
      const tokenResult = await tokenManager.getValidToken();
      if (tokenResult.type !== RepositoryResultType.SUCCESS) throw new Error('Not authenticated');

      const response = await fetch(apiConfig.endpoints.pat.list, {
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenResult.data}` },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
};
