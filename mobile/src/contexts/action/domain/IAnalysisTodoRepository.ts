/**
 * Analysis Todo Repository Interface
 *
 * Association table between capture_analysis and todos.
 * Tracks which AI analysis generated which todos.
 */

export interface AnalysisTodo {
  todoId: string;
  analysisId: string;
  actionItemIndex?: number;
  createdAt: number;
}

export interface IAnalysisTodoRepository {
  /**
   * Link a todo to an analysis
   * @param todoId - Todo UUID
   * @param analysisId - CaptureAnalysis UUID
   * @param actionItemIndex - Optional index of the action item in the analysis
   */
  link(todoId: string, analysisId: string, actionItemIndex?: number): Promise<void>;

  /**
   * Find all todo IDs linked to a given analysis
   * @param analysisId - CaptureAnalysis UUID
   * @returns Array of todo IDs
   */
  findTodoIdsByAnalysisId(analysisId: string): Promise<string[]>;

  /**
   * Find the todo ID linked to a specific analysis and action item index
   * @param analysisId - CaptureAnalysis UUID
   * @param actionItemIndex - Index of the action item in the analysis
   * @returns Todo ID or null if not found
   */
  findTodoIdByAnalysisAndIndex(analysisId: string, actionItemIndex: number): Promise<string | null>;

  /**
   * Delete all todos associated with a given analysis.
   * CASCADE on analysis_todos will also remove the association rows.
   * @param analysisId - CaptureAnalysis UUID
   * @returns Number of todos deleted
   */
  deleteByAnalysisId(analysisId: string): Promise<number>;
}
