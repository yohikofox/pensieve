/**
 * Digestion Response Schema
 * Zod schema for GPT-4o-mini response validation
 *
 * Covers Subtask 2.3: Implement response schema validation (Zod)
 * AC1: GPT-4o-mini Integration and Prompt Engineering
 *
 * Story 4.3 Enhancement:
 * Subtask 1.2: Enhance DigestionResponseSchema to include todos array
 * Subtask 1.3: Add todo format specification (description, deadline text, priority)
 */

import { z } from 'zod';

/**
 * Todo Schema for extracted actionable tasks
 * Story 4.3 - AC1: Single LLM Call Integration
 *
 * Requirements:
 * - Description: 3-200 characters (actionable task description)
 * - Deadline: Optional text (e.g., "Friday", "tomorrow", null if no deadline)
 * - Priority: Enum (low/medium/high)
 */
export const TodoSchema = z.object({
  description: z
    .string()
    .min(3, 'Todo description must be at least 3 characters')
    .max(200, 'Todo description must not exceed 200 characters')
    .refine((val) => val.trim().length > 0, {
      message: 'Todo description cannot be empty or whitespace only',
    }),

  deadline: z
    .string()
    .max(50, 'Deadline text must not exceed 50 characters')
    .nullable(),

  priority: z.enum(['low', 'medium', 'high']),
});

/**
 * Digestion Response Schema
 * Validates the structure and content of GPT-4o-mini responses
 *
 * Requirements:
 * - Summary: 10-500 characters (concise, 2-3 sentences)
 * - Ideas: 1-10 bullet points, each 5-200 characters
 * - Todos: 0-10 actionable tasks (Story 4.3)
 * - Confidence: Optional indicator of analysis quality
 */
export const DigestionResponseSchema = z.object({
  summary: z
    .string()
    .min(10, 'Summary must be at least 10 characters')
    .max(500, 'Summary must not exceed 500 characters')
    .refine((val) => val.trim().length > 0, {
      message: 'Summary cannot be empty or whitespace only',
    }),

  ideas: z
    .array(
      z
        .string()
        .min(5, 'Each idea must be at least 5 characters')
        .max(200, 'Each idea must not exceed 200 characters')
        .refine((val) => val.trim().length > 0, {
          message: 'Idea cannot be empty or whitespace only',
        }),
    )
    .min(1, 'At least one idea is required')
    .max(10, 'Maximum 10 ideas allowed'),

  todos: z
    .array(TodoSchema)
    .max(10, 'Maximum 10 todos allowed')
    .optional()
    .default([]),

  confidence: z.enum(['high', 'medium', 'low']).optional().default('high'),
});

/**
 * TypeScript types inferred from schemas
 */
export type TodoExtraction = z.infer<typeof TodoSchema>;
export type DigestionResponse = z.infer<typeof DigestionResponseSchema>;

/**
 * Validate and parse digestion response
 *
 * @param data - Raw response data from GPT
 * @returns Validated DigestionResponse
 * @throws ZodError if validation fails
 */
export function validateDigestionResponse(data: unknown): DigestionResponse {
  return DigestionResponseSchema.parse(data);
}

/**
 * Safe validate without throwing
 *
 * @param data - Raw response data from GPT
 * @returns Success with data or error with issues
 */
export function safeValidateDigestionResponse(data: unknown) {
  return DigestionResponseSchema.safeParse(data);
}
