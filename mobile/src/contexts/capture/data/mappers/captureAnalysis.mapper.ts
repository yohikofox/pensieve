/**
 * Capture Analysis Row Mapper - Data Access Layer
 *
 * Maps SQLite row (snake_case) to domain CaptureAnalysis interface (camelCase).
 * Extracted from domain layer to respect Clean Architecture dependency rule.
 */

import type { CaptureAnalysis, AnalysisType } from "../../domain/CaptureAnalysis.model";

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
export function mapRowToCaptureAnalysis(
  row: CaptureAnalysisRow,
): CaptureAnalysis {
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
