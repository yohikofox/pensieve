/**
 * useIdeas Hook
 *
 * Manages structured ideas loading for a capture
 * Story 5.1 - Task 10.4: Structured ideas display
 */

import { useState, useEffect } from "react";
import { container } from "tsyringe";
import { TOKENS } from "../infrastructure/di/tokens";
import type { IThoughtRepository } from "../contexts/knowledge/domain/IThoughtRepository";
import type { IIdeaRepository } from "../contexts/knowledge/domain/IIdeaRepository";
import type { Idea } from "../contexts/knowledge/domain/Idea.model";
import type { Capture } from "../contexts/capture/domain/Capture.model";

interface UseIdeasParams {
  capture: Capture | null;
}

interface UseIdeasReturn {
  ideas: Idea[];
  ideasLoading: boolean;
}

export function useIdeas({ capture }: UseIdeasParams): UseIdeasReturn {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);

  useEffect(() => {
    const loadIdeas = async () => {
      if (!capture) {
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
        const thought = await thoughtRepository.findByCaptureId(capture.id);

        if (thought) {
          // Load ideas by thoughtId
          const loadedIdeas = await ideaRepository.findByThoughtId(thought.id);
          setIdeas(loadedIdeas);
        } else {
          setIdeas([]);
        }
      } catch (error) {
        console.error("[useIdeas] Failed to load ideas:", error);
        setIdeas([]); // Fail gracefully
      } finally {
        setIdeasLoading(false);
      }
    };

    loadIdeas();
  }, [capture]);

  return {
    ideas,
    ideasLoading,
  };
}
