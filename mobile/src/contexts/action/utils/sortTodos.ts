import { Todo } from "../domain/Todo.model";
import { groupTodosByDeadline, TodoSection } from "./groupTodosByDeadline";
import { getUrgencyLevel, UrgencyLevel } from "./getUrgencyLevel";

export type SortType = "default" | "priority" | "createdDate" | "alphabetical";

/**
 * Sort todos by selected sort type
 * Story 5.3 - AC5, AC6, AC7, Task 6: Client-side sorting logic
 *
 * @param todos - Array of todos to sort
 * @param sort - Sort type to apply
 * @returns Sorted todos (as sections for 'default' or flat array for others)
 */
export const sortTodos = (
  todos: Todo[],
  sort: SortType,
): TodoSection[] | Todo[] => {
  switch (sort) {
    case "default":
      // AC5: Use groupTodosByDeadline from Story 5.2
      // Returns sections: Overdue → Today → This Week → Later → No Deadline
      return groupTodosByDeadline(todos);

    case "priority": {
      // Story 8.15 AC6: Sort by urgency level (En retard → Prioritaires → Approchantes → Normales)
      // Pre-compute urgency map to avoid O(N log N) calls to getUrgencyLevel/formatDeadline
      const URGENCY_ORDER: Record<UrgencyLevel, number> = {
        overdue:     0,
        prioritaire: 1,
        approaching: 2,
        normal:      3,
      };
      const urgencyMap = new Map(todos.map((t) => [t.id, URGENCY_ORDER[getUrgencyLevel(t)]]));
      return [...todos].sort((a, b) => {
        const urgencyDiff = urgencyMap.get(a.id)! - urgencyMap.get(b.id)!;
        if (urgencyDiff !== 0) return urgencyDiff;

        // Secondary: deadline (nulls last)
        if (a.deadline && b.deadline) return a.deadline - b.deadline;
        if (a.deadline) return -1;
        if (b.deadline) return 1;

        // Tertiary: createdAt
        return a.createdAt - b.createdAt;
      });
    }

    case "createdDate":
      // AC7: Sort by createdAt DESC (newest first)
      return [...todos].sort((a, b) => b.createdAt - a.createdAt);

    case "alphabetical":
      // AC5: Sort by description ASC (A-Z, French locale)
      return [...todos].sort((a, b) =>
        a.description.localeCompare(b.description, "fr", {
          sensitivity: "base",
        }),
      );

    default:
      return todos;
  }
};

/**
 * Check if sorted result is sections (default) or flat list
 * Used for conditional rendering in ActionsScreen
 *
 * @param data - Sorted data from sortTodos
 * @returns true if data is TodoSection[], false if Todo[]
 */
export const isSectionData = (
  data: TodoSection[] | Todo[],
): data is TodoSection[] => {
  return Array.isArray(data) && data.length > 0 && "title" in data[0];
};
