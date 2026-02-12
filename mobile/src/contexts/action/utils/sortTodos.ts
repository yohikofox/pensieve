import { Todo } from "../domain/Todo.model";
import { groupTodosByDeadline, TodoSection } from "./groupTodosByDeadline";

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

    case "priority":
      // AC6: Sort by priority (High → Medium → Low), secondary by deadline
      return [...todos].sort((a, b) => {
        const priorityOrder: Record<string, number> = {
          high: 0,
          medium: 1,
          low: 2,
        };

        // Primary sort: priority
        const priorityDiff =
          priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        // Secondary sort: deadline (nulls last)
        const aDeadline = a.deadline ?? Infinity;
        const bDeadline = b.deadline ?? Infinity;
        return aDeadline - bDeadline;
      });

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
