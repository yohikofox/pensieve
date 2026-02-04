/**
 * Priority Inference Service
 * Infers todo priority from content keywords
 *
 * Story 4.3 - Task 4: Priority Inference Logic (AC4)
 * Simple keyword-based priority detection with confidence scoring
 */

import { Injectable } from '@nestjs/common';

export interface PriorityInferenceResult {
  priority: 'low' | 'medium' | 'high';
  confidence: number; // 0-1
}

@Injectable()
export class PriorityInferenceService {
  private readonly highPriorityKeywords = [
    'urgent', 'asap', 'critique', 'immédiatement', 'immediately',
    'critical', 'au plus vite', 'deadline', 'avant', 'before'
  ];

  private readonly mediumPriorityKeywords = [
    'important', 'faut que', 'je dois', 'need to', 'should',
    "n'oublie pas", "don't forget"
  ];

  private readonly lowPriorityKeywords = [
    'peut-être', 'maybe', 'quand j\'ai le temps', 'when i have time',
    'someday', 'un jour', 'nice to have', 'éventuellement'
  ];

  /**
   * Infer priority from description text
   * Subtasks 4.1-4.5: Keyword-based priority detection
   */
  infer(description: string): PriorityInferenceResult {
    const lower = description.toLowerCase();

    // Check high priority keywords
    const hasHighKeyword = this.highPriorityKeywords.some(kw => lower.includes(kw));
    if (hasHighKeyword) {
      return { priority: 'high', confidence: 0.9 };
    }

    // Check low priority keywords
    const hasLowKeyword = this.lowPriorityKeywords.some(kw => lower.includes(kw));
    if (hasLowKeyword) {
      return { priority: 'low', confidence: 0.8 };
    }

    // Check medium priority keywords
    const hasMediumKeyword = this.mediumPriorityKeywords.some(kw => lower.includes(kw));
    if (hasMediumKeyword) {
      return { priority: 'medium', confidence: 0.7 };
    }

    // Default to medium with low confidence
    return { priority: 'medium', confidence: 0.3 };
  }
}
