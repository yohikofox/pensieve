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

      expect(result).toEqual(validResponse);
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

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(ZodError);
    });

    it('should reject summary longer than 500 characters', () => {
      const longSummary = 'a'.repeat(501);
      const invalidResponse = {
        summary: longSummary,
        ideas: ['Valid idea'],
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(ZodError);
    });

    it('should reject empty summary', () => {
      const invalidResponse = {
        summary: '',
        ideas: ['Valid idea'],
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(ZodError);
    });

    it('should reject whitespace-only summary', () => {
      const invalidResponse = {
        summary: '           ',
        ideas: ['Valid idea'],
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(ZodError);
    });

    it('should reject missing summary', () => {
      const invalidResponse = {
        ideas: ['Valid idea'],
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(ZodError);
    });
  });

  describe('Invalid Ideas', () => {
    it('should reject empty ideas array', () => {
      const invalidResponse = {
        summary: 'Valid summary',
        ideas: [],
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(ZodError);
    });

    it('should reject more than 10 ideas', () => {
      const tooManyIdeas = Array(11)
        .fill(0)
        .map((_, idx) => `Idea ${idx + 1}`);
      const invalidResponse = {
        summary: 'Valid summary',
        ideas: tooManyIdeas,
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(ZodError);
    });

    it('should reject idea shorter than 5 characters', () => {
      const invalidResponse = {
        summary: 'Valid summary',
        ideas: ['Ok', 'Valid idea here'],
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(ZodError);
    });

    it('should reject idea longer than 200 characters', () => {
      const longIdea = 'a'.repeat(201);
      const invalidResponse = {
        summary: 'Valid summary',
        ideas: [longIdea],
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(ZodError);
    });

    it('should reject whitespace-only idea', () => {
      const invalidResponse = {
        summary: 'Valid summary',
        ideas: ['     '],
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(ZodError);
    });

    it('should reject missing ideas array', () => {
      const invalidResponse = {
        summary: 'Valid summary',
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(ZodError);
    });
  });

  describe('Invalid Confidence', () => {
    it('should reject invalid confidence value', () => {
      const invalidResponse = {
        summary: 'Valid summary',
        ideas: ['Valid idea'],
        confidence: 'unknown',
      };

      expect(() => validateDigestionResponse(invalidResponse)).toThrow(ZodError);
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
        expect(result.data).toEqual(validResponse);
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
        expect(errorMessages).toContain('Summary must be at least 10 characters');
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
});
