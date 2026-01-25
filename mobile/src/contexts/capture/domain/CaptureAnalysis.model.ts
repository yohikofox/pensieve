/**
 * Capture Analysis Model
 *
 * Represents an LLM-generated analysis result associated with a Capture.
 * Used for storing summary, highlights, and action items from AI analysis.
 *
 * @aggregate Capture
 */

/**
 * Analysis type enumeration
 */
export const ANALYSIS_TYPES = {
  SUMMARY: 'summary',
  HIGHLIGHTS: 'highlights',
  ACTION_ITEMS: 'action_items',
} as const;

export type AnalysisType = (typeof ANALYSIS_TYPES)[keyof typeof ANALYSIS_TYPES];

/**
 * Capture Analysis domain model
 */
export interface CaptureAnalysis {
  id: string;
  captureId: string;
  analysisType: AnalysisType;
  content: string;
  modelId: string | null;
  processingDurationMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Database row type (snake_case from SQLite)
 */
export interface CaptureAnalysisRow {
  id: string;
  capture_id: string;
  analysis_type: string;
  content: string;
  model_id: string | null;
  processing_duration_ms: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * Map database row to domain model
 */
export function mapRowToCaptureAnalysis(row: CaptureAnalysisRow): CaptureAnalysis {
  return {
    id: row.id,
    captureId: row.capture_id,
    analysisType: row.analysis_type as AnalysisType,
    content: row.content,
    modelId: row.model_id,
    processingDurationMs: row.processing_duration_ms,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Input for creating/updating analysis
 */
export interface SaveAnalysisInput {
  captureId: string;
  analysisType: AnalysisType;
  content: string;
  modelId?: string;
  processingDurationMs?: number;
}
