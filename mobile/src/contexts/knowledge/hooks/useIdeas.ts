/**
 * useIdeas Hook
 *
 * Story 5.1 - Task 10: Integration with Feed Screen
 * React Query hook for fetching ideas by thoughtId
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { TOKENS } from '../../../infrastructure/di/tokens';
import type { IIdeaRepository } from '../domain/IIdeaRepository';
import type { Idea } from '../domain/Idea.model';

/**
 * Fetch ideas for a specific thought
 * Used in CaptureDetailScreen to display ideas with inline todos
 *
 * @param thoughtId - ID of the thought to fetch ideas for
 * @returns React Query result with ideas array
 */
export const useIdeas = (thoughtId: string): UseQueryResult<Idea[], Error> => {
  const ideaRepository = container.resolve<IIdeaRepository>(TOKENS.IIdeaRepository);

  return useQuery({
    queryKey: ['ideas', thoughtId],
    queryFn: () => ideaRepository.findByThoughtId(thoughtId),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    enabled: !!thoughtId, // Only run query if thoughtId is provided
  });
};
