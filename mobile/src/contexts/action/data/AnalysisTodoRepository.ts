/**
 * Analysis Todo Repository Implementation (OP-SQLite)
 *
 * Association table between capture_analysis and todos.
 * Tracks which AI analysis generated which todos.
 */

import { injectable } from 'tsyringe';
import { database } from '../../../database';
import type { IAnalysisTodoRepository } from '../domain/IAnalysisTodoRepository';

@injectable()
export class AnalysisTodoRepository implements IAnalysisTodoRepository {

  async link(todoId: string, analysisId: string, actionItemIndex?: number): Promise<void> {
    database.execute(
      `INSERT INTO analysis_todos (todo_id, analysis_id, action_item_index, created_at)
       VALUES (?, ?, ?, ?)`,
      [todoId, analysisId, actionItemIndex ?? null, Date.now()]
    );
  }

  async findTodoIdByAnalysisAndIndex(analysisId: string, actionItemIndex: number): Promise<string | null> {
    const result = database.execute(
      `SELECT todo_id FROM analysis_todos WHERE analysis_id = ? AND action_item_index = ?`,
      [analysisId, actionItemIndex]
    );

    const rows = result.rows || [];
    if (rows.length === 0) {
      return null;
    }

    return rows[0].todo_id as string;
  }

  async findTodoIdsByAnalysisId(analysisId: string): Promise<string[]> {
    const result = database.execute(
      `SELECT todo_id FROM analysis_todos WHERE analysis_id = ?`,
      [analysisId]
    );

    const rows = result.rows || [];
    return rows.map((row: any) => row.todo_id as string);
  }

  async deleteByAnalysisId(analysisId: string): Promise<number> {
    const result = database.execute(
      `DELETE FROM todos WHERE id IN (SELECT todo_id FROM analysis_todos WHERE analysis_id = ?)`,
      [analysisId]
    );

    return result.rowsAffected || 0;
  }
}
