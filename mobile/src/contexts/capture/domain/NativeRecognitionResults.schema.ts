/**
 * Native Recognition Results Schema
 *
 * Zod schema for validating native speech recognition results
 * stored in capture metadata. Used by both NativeTranscriptionEngine
 * (writing) and NativeRecognitionDebugCard (reading).
 */

import { z } from "zod";

const SegmentSchema = z.object({
  startTimeMillis: z.number(),
  endTimeMillis: z.number(),
  segment: z.string(),
  confidence: z.number(),
});

export const NativeRecognitionResultsSchema = z.object({
  selectedIndex: z.number(),
  selectionReason: z.string(),
  results: z.array(
    z.object({
      transcript: z.string(),
      confidence: z.number().nullable().optional(),
      segments: z.array(SegmentSchema).optional(),
    }),
  ),
});

export type NativeRecognitionResults = z.infer<
  typeof NativeRecognitionResultsSchema
>;
