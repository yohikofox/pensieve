/**
 * Capture Analysis Repository - Data Access Layer
 *
 * OP-SQLite-based implementation for CaptureAnalysis storage.
 *
 * Handles:
 * - CRUD operations on CaptureAnalysis entities
 * - Upsert based on captureId + analysisType
 * - Retrieval by capture or type
 */

import "reflect-metadata";
import { injectable } from "tsyringe";
import { v4 as uuidv4 } from "uuid";
import { database } from "../../../database";
import {
  type CaptureAnalysis,
  type CaptureAnalysisRow,
  type AnalysisType,
  type SaveAnalysisInput,
  ANALYSIS_TYPES,
  mapRowToCaptureAnalysis,
} from "../domain/CaptureAnalysis.model";
import type { ICaptureAnalysisRepository } from "../domain/ICaptureAnalysisRepository";

@injectable()
export class CaptureAnalysisRepository implements ICaptureAnalysisRepository {
  /**
   * Get analysis by capture ID and type
   */
  async get(
    captureId: string,
    type: AnalysisType,
  ): Promise<CaptureAnalysis | null> {
    const result = database.execute(
      "SELECT * FROM capture_analysis WHERE capture_id = ? AND analysis_type = ?",
      [captureId, type],
    );

    const row = result.rows?.[0] as CaptureAnalysisRow | undefined;
    return row ? mapRowToCaptureAnalysis(row) : null;
  }

  /**
   * Get all analyses for a capture
   */
  async getAllForCapture(captureId: string): Promise<CaptureAnalysis[]> {
    const result = database.execute(
      "SELECT * FROM capture_analysis WHERE capture_id = ? ORDER BY analysis_type ASC",
      [captureId],
    );

    const rows = (result.rows ?? []) as CaptureAnalysisRow[];
    return rows.map(mapRowToCaptureAnalysis);
  }

  /**
   * Get all analyses for a capture as a map keyed by type
   */
  async getAllAsMap(
    captureId: string,
  ): Promise<Record<AnalysisType, CaptureAnalysis | null>> {
    const analyses = await this.getAllForCapture(captureId);
    const map: Record<AnalysisType, CaptureAnalysis | null> = {
      [ANALYSIS_TYPES.SUMMARY]: null,
      [ANALYSIS_TYPES.HIGHLIGHTS]: null,
      [ANALYSIS_TYPES.ACTION_ITEMS]: null,
      [ANALYSIS_TYPES.IDEAS]: null,
    };

    for (const analysis of analyses) {
      map[analysis.analysisType] = analysis;
    }

    return map;
  }

  /**
   * Save an analysis (upsert - creates or updates based on captureId + type)
   */
  async save(input: SaveAnalysisInput): Promise<CaptureAnalysis> {
    const now = Date.now();

    // Check if entry exists
    const existing = database.execute(
      "SELECT id FROM capture_analysis WHERE capture_id = ? AND analysis_type = ?",
      [input.captureId, input.analysisType],
    );

    let id: string;

    if (existing.rows && existing.rows.length > 0) {
      // Update existing
      id = (existing.rows[0] as { id: string }).id;
      database.execute(
        `UPDATE capture_analysis
         SET content = ?, model_id = ?, processing_duration_ms = ?, updated_at = ?
         WHERE id = ?`,
        [
          input.content,
          input.modelId ?? null,
          input.processingDurationMs ?? null,
          now,
          id,
        ],
      );
    } else {
      // Insert new
      id = uuidv4();
      database.execute(
        `INSERT INTO capture_analysis
         (id, capture_id, analysis_type, content, model_id, processing_duration_ms, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.captureId,
          input.analysisType,
          input.content,
          input.modelId ?? null,
          input.processingDurationMs ?? null,
          now,
          now,
        ],
      );
    }

    // Return the saved analysis
    const result = database.execute(
      "SELECT * FROM capture_analysis WHERE id = ?",
      [id],
    );
    const row = result.rows?.[0] as CaptureAnalysisRow;
    return mapRowToCaptureAnalysis(row);
  }

  /**
   * Delete a specific analysis
   */
  async delete(captureId: string, type: AnalysisType): Promise<void> {
    database.execute(
      "DELETE FROM capture_analysis WHERE capture_id = ? AND analysis_type = ?",
      [captureId, type],
    );
  }

  /**
   * Delete all analyses for a capture
   */
  async deleteAllForCapture(captureId: string): Promise<void> {
    database.execute("DELETE FROM capture_analysis WHERE capture_id = ?", [
      captureId,
    ]);
  }
}
