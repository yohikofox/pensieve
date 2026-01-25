/**
 * Capture Analysis Repository Interface
 *
 * Defines data access operations for CaptureAnalysis entities.
 */

import type { CaptureAnalysis, AnalysisType, SaveAnalysisInput } from './CaptureAnalysis.model';

export interface ICaptureAnalysisRepository {
  /**
   * Get analysis by capture ID and type
   */
  get(captureId: string, type: AnalysisType): Promise<CaptureAnalysis | null>;

  /**
   * Get all analyses for a capture
   */
  getAllForCapture(captureId: string): Promise<CaptureAnalysis[]>;

  /**
   * Get all analyses for a capture as a map keyed by type
   */
  getAllAsMap(captureId: string): Promise<Record<AnalysisType, CaptureAnalysis | null>>;

  /**
   * Save an analysis (upsert - creates or updates based on captureId + type)
   */
  save(input: SaveAnalysisInput): Promise<CaptureAnalysis>;

  /**
   * Delete a specific analysis
   */
  delete(captureId: string, type: AnalysisType): Promise<void>;

  /**
   * Delete all analyses for a capture
   */
  deleteAllForCapture(captureId: string): Promise<void>;
}
