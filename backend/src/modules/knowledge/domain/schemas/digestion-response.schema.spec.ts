/**
 * Digestion Response Schema Tests
 * Tests for Zod schema validation
 *
 * Covers Subtask 2.3: Response schema validation tests
 */

import {
  DigestionResponseSchema,
  validateDigestionResponse,
  safeValidateDigestionResponse,
  type DigestionResponse,
} from './digestion-response.schema';
import { ZodError } from 'zod';

describe('DigestionResponseSchema', () => {
  describe('Valid Responses', () => {
    it('should validate a valid response with all fields', () => {
      const validResponse = {
        summary: 'This is a concise summary of the thought.',
        ideas: ['First key idea', 'Second key idea', 'Third key idea'],
        confidence: 'high' as const,
      };

      const result = validateDigestionResponse(validResponse);

      expect(result).toMatchObject(validResponse);
      expect(result.todos).toEqual([]); // Default empty array (Story 4.3)
    });

    it('should validate a response without confidence field', () => {
      const validResponse = {
        summary: 'Summary without confidence field.',
        ideas: ['Single idea'],
      };

      const result = validateDigestionResponse(validResponse);

      expect(result.summary).toBe(validResponse.summary);
      expect(result.ideas).toEqual(validResponse.ideas);
      expect(result.confidence).toBe('high'); // Default value
    });

    it('should validate responses with 1-10 ideas', () => {
      for (let i = 1; i <= 10; i++) {
        const ideas = Array(i)
          .fill(0)
          .map((_, idx) => `Idea number ${idx + 1}`);
        const response = {
          summary: 'Valid summary',
          ideas,
        };

        expect(() => validateDigestionResponse(response)).not.toThrow();
      }
    });

    it('should accept all confidence levels', () => {
      const confidenceLevels: Array<'high' | 'medium' | 'low'> = [
        'high',
        'medium',
        'low',
      ];

      for (const confidence of confidenceLevels) {
        const response = {
          summary: 'Summary text',
          ideas: ['Idea 1'],
          confidence,
        };

        const result = validateDigestionResponse(response);
        expect(result.confidence).toBe(confidence);
      }
    });
  });

  describe('Invalid Summary', () => {
    it('should reject summary shorter than 10 characters', () => {
      const invalidResponse = {
        summary: 'Short',
        ideas: ['Valid idea'],
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(
        ZodError,
      );
    });

    it('should reject summary longer than 500 characters', () => {
      const longSummary = 'a'.repeat(501);
      const invalidResponse = {
        summary: longSummary,
        ideas: ['Valid idea'],
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(
        ZodError,
      );
    });

    it('should reject empty summary', () => {
      const invalidResponse = {
        summary: '',
        ideas: ['Valid idea'],
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(
        ZodError,
      );
    });

    it('should reject whitespace-only summary', () => {
      const invalidResponse = {
        summary: '           ',
        ideas: ['Valid idea'],
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(
        ZodError,
      );
    });

    it('should reject missing summary', () => {
      const invalidResponse = {
        ideas: ['Valid idea'],
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(
        ZodError,
      );
    });
  });

  describe('Invalid Ideas', () => {
    it('should reject empty ideas array', () => {
      const invalidResponse = {
        summary: 'Valid summary',
        ideas: [],
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(
        ZodError,
      );
    });

    it('should reject more than 10 ideas', () => {
      const tooManyIdeas = Array(11)
        .fill(0)
        .map((_, idx) => `Idea ${idx + 1}`);
      const invalidResponse = {
        summary: 'Valid summary',
        ideas: tooManyIdeas,
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(
        ZodError,
      );
    });

    it('should reject idea shorter than 5 characters', () => {
      const invalidResponse = {
        summary: 'Valid summary',
        ideas: ['Ok', 'Valid idea here'],
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(
        ZodError,
      );
    });

    it('should reject idea longer than 200 characters', () => {
      const longIdea = 'a'.repeat(201);
      const invalidResponse = {
        summary: 'Valid summary',
        ideas: [longIdea],
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(
        ZodError,
      );
    });

    it('should reject whitespace-only idea', () => {
      const invalidResponse = {
        summary: 'Valid summary',
        ideas: ['     '],
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(
        ZodError,
      );
    });

    it('should reject missing ideas array', () => {
      const invalidResponse = {
        summary: 'Valid summary',
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(
        ZodError,
      );
    });
  });

  describe('Invalid Confidence', () => {
    it('should reject invalid confidence value', () => {
      const invalidResponse = {
        summary: 'Valid summary',
        ideas: ['Valid idea'],
        confidence: 'unknown',
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(
        ZodError,
      );
    });
  });

  describe('Safe Validation', () => {
    it('should return success for valid response', () => {
      const validResponse = {
        summary: 'Valid summary text',
        ideas: ['First idea', 'Second idea'],
        confidence: 'medium' as const,
      };

      const result = safeValidateDigestionResponse(validResponse);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatchObject(validResponse);
        expect(result.data.todos).toEqual([]); // Default empty array (Story 4.3)
      }
    });

    it('should return error for invalid response', () => {
      const invalidResponse = {
        summary: 'Short',
        ideas: [],
      };

      const result = safeValidateDigestionResponse(invalidResponse);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ZodError);
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it('should provide detailed error messages', () => {
      const invalidResponse = {
        summary: '',
        ideas: ['Valid idea'],
      };

      const result = safeValidateDigestionResponse(invalidResponse);

      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.issues.map((issue) => issue.message);
        expect(errorMessages).toContain(
          'Summary must be at least 10 characters',
        );
      }
    });
  });

  describe('Type Safety', () => {
    it('should infer correct TypeScript type', () => {
      const response: DigestionResponse = {
        summary: 'Type-safe summary',
        ideas: ['Type-safe idea'],
        confidence: 'high',
      };

      // TypeScript compilation will fail if types are wrong
      expect(response.summary).toBeDefined();
      expect(response.ideas).toBeDefined();
      expect(response.confidence).toBeDefined();
    });
  });

  /**
   * Story 4.3 - Todo Extraction Tests
   * Subtask 1.6: Add unit tests for new schema validation with todos
   */
  describe('Todos Extraction (Story 4.3)', () => {
    describe('Valid Todos', () => {
      it('should validate response with empty todos array (AC6)', () => {
        const validResponse = {
          summary: 'This capture has no actions.',
          ideas: ['Just an observation'],
          todos: [],
        };

        const result = validateDigestionResponse(validResponse);

        expect(result.todos).toEqual([]);
      });

      it('should validate response with single todo', () => {
        const validResponse = {
          summary: 'Summary with one action',
          ideas: ['Key idea'],
          todos: [
            {
              description: 'Send invoice to client',
              deadline: 'Friday',
              priority: 'high' as const,
            },
          ],
        };

        const result = validateDigestionResponse(validResponse);

        expect(result.todos).toHaveLength(1);
        expect(result.todos[0].description).toBe('Send invoice to client');
        expect(result.todos[0].deadline).toBe('Friday');
        expect(result.todos[0].priority).toBe('high');
      });

      it('should validate response with multiple todos (AC5)', () => {
        const validResponse = {
          summary: 'Summary with multiple actions',
          ideas: ['Key idea'],
          todos: [
            {
              description: 'Send invoice',
              deadline: 'Friday',
              priority: 'high' as const,
            },
            {
              description: 'Buy milk',
              deadline: 'today',
              priority: 'low' as const,
            },
            {
              description: 'Research competitor',
              deadline: null,
              priority: 'medium' as const,
            },
          ],
        };

        const result = validateDigestionResponse(validResponse);

        expect(result.todos).toHaveLength(3);
        expect(result.todos[2].deadline).toBeNull();
      });

      it('should accept up to 10 todos', () => {
        const todos = Array(10)
          .fill(0)
          .map((_, idx) => ({
            description: `Todo number ${idx + 1}`,
            deadline: idx % 2 === 0 ? 'tomorrow' : null,
            priority: 'medium' as const,
          }));

        const validResponse = {
          summary: 'Summary with many todos',
          ideas: ['Key idea'],
          todos,
        };

        expect(() => validateDigestionResponse(validResponse)).not.toThrow();
      });

      it('should accept all priority levels', () => {
        const priorities: Array<'low' | 'medium' | 'high'> = [
          'low',
          'medium',
          'high',
        ];

        for (const priority of priorities) {
          const response = {
            summary: 'This is a valid summary for testing',
            ideas: ['Valid key idea'],
            todos: [
              {
                description: 'Test todo',
                deadline: null,
                priority,
              },
            ],
          };

          const result = validateDigestionResponse(response);
          expect(result.todos[0].priority).toBe(priority);
        }
      });

      it('should accept null deadline (AC3)', () => {
        const validResponse = {
          summary: 'This is a valid summary',
          ideas: ['Valid key idea'],
          todos: [
            {
              description: 'Todo without deadline',
              deadline: null,
              priority: 'medium' as const,
            },
          ],
        };

        const result = validateDigestionResponse(validResponse);
        expect(result.todos[0].deadline).toBeNull();
      });
    });

    describe('Invalid Todos', () => {
      it('should reject todos with more than 10 items', () => {
        const tooManyTodos = Array(11)
          .fill(0)
          .map((_, idx) => ({
            description: `Todo ${idx + 1}`,
            deadline: null,
            priority: 'medium' as const,
          }));

        const invalidResponse = {
          summary: 'Valid summary',
          ideas: ['Valid idea'],
          todos: tooManyTodos,
        };

        expect(() => validateDigestionResponse(invalidResponse)).toThrow(
          ZodError,
        );
      });

      it('should reject todo with description shorter than 3 characters', () => {
        const invalidResponse = {
          summary: 'Valid summary',
          ideas: ['Valid idea'],
          todos: [
            {
              description: 'Go',
              deadline: null,
              priority: 'medium' as const,
            },
          ],
        };

        expect(() => validateDigestionResponse(invalidResponse)).toThrow(
          ZodError,
        );
      });

      it('should reject todo with description longer than 200 characters', () => {
        const longDescription = 'a'.repeat(201);
        const invalidResponse = {
          summary: 'Valid summary',
          ideas: ['Valid idea'],
          todos: [
            {
              description: longDescription,
              deadline: null,
              priority: 'medium' as const,
            },
          ],
        };

        expect(() => validateDigestionResponse(invalidResponse)).toThrow(
          ZodError,
        );
      });

      it('should reject todo with invalid priority', () => {
        const invalidResponse = {
          summary: 'Valid summary',
          ideas: ['Valid idea'],
          todos: [
            {
              description: 'Valid description',
              deadline: null,
              priority: 'urgent',
            },
          ],
        };

        expect(() => validateDigestionResponse(invalidResponse)).toThrow(
          ZodError,
        );
      });

      it('should reject todo with missing description', () => {
        const invalidResponse = {
          summary: 'Valid summary',
          ideas: ['Valid idea'],
          todos: [
            {
              deadline: 'Friday',
              priority: 'high' as const,
            },
          ],
        };

        expect(() => validateDigestionResponse(invalidResponse)).toThrow(
          ZodError,
        );
      });

      it('should reject todo with missing priority', () => {
        const invalidResponse = {
          summary: 'Valid summary',
          ideas: ['Valid idea'],
          todos: [
            {
              description: 'Valid description',
              deadline: null,
            },
          ],
        };

        expect(() => validateDigestionResponse(invalidResponse)).toThrow(
          ZodError,
        );
      });

      it('should reject todo with deadline longer than 50 characters', () => {
        const longDeadline = 'a'.repeat(51);
        const invalidResponse = {
          summary: 'Valid summary',
          ideas: ['Valid idea'],
          todos: [
            {
              description: 'Valid description',
              deadline: longDeadline,
              priority: 'medium' as const,
            },
          ],
        };

        expect(() => validateDigestionResponse(invalidResponse)).toThrow(
          ZodError,
        );
      });
    });

    describe('Backward Compatibility', () => {
      it('should validate responses without todos field (backward compat)', () => {
        const validResponse = {
          summary: 'Summary without todos',
          ideas: ['Key idea'],
        };

        const result = validateDigestionResponse(validResponse);

        expect(result.todos).toEqual([]); // Default to empty array
      });
    });
  });
});
