/**
 * useIdeas Hook
 *
 * Autonomous hook for ideas loading.
 * Reads/writes to unified captureDetailStore.
 *
 * Story 5.1 - Task 10.4: Structured ideas display
 * Story 5.4 - Unified store: no more captureId indexing
 */

import { useEffect } from "react";
import { container } from "tsyringe";
import { TOKENS } from "../infrastructure/di/tokens";
import type { IThoughtRepository } from "../contexts/knowledge/domain/IThoughtRepository";
import type { IIdeaRepository } from "../contexts/knowledge/domain/IIdeaRepository";
import type { Idea } from "../contexts/knowledge/domain/Idea.model";
import { useCaptureDetailStore } from "../stores/captureDetailStore";

interface UseIdeasReturn {
  ideas: Idea[];
  ideasLoading: boolean;
}

export function useIdeas(): UseIdeasReturn {
  // Read from unified store
  const captureId = useCaptureDetailStore((state) => state.captureId);
  const ideas = useCaptureDetailStore((state) => state.ideas);
  const ideasLoading = useCaptureDetailStore((state) => state.ideasLoading);
  const setIdeas = useCaptureDetailStore((state) => state.setIdeas);
  const setIdeasLoading = useCaptureDetailStore((state) => state.setIdeasLoading);

  useEffect(() => {
    const loadIdeas = async () => {
      if (!captureId) {
        setIdeas([]);
        return;
      }

      try {
        setIdeasLoading(true);

        const thoughtRepository = container.resolve<IThoughtRepository>(
          TOKENS.IThoughtRepository,
        );
        const ideaRepository = container.resolve<IIdeaRepository>(
          TOKENS.IIdeaRepository,
        );

        // Find thought associated with this capture
        const thought = await thoughtRepository.findByCaptureId(captureId);

        if (thought) {
          // Load ideas by thoughtId
          const loadedIdeas = await ideaRepository.findByThoughtId(thought.id);
          setIdeas(loadedIdeas);
        } else {
          setIdeas([]);
        }
      } catch (error) {
        console.error("[useIdeas] Failed to load ideas:", error);
        setIdeas([]);
      } finally {
        setIdeasLoading(false);
      }
    };

    loadIdeas();
  }, [captureId, setIdeas, setIdeasLoading]);

  return {
    ideas,
    ideasLoading,
  };
}
