import { Todo } from "../domain/Todo.model";

export type FilterType = "all" | "active" | "completed" | "trash";

/**
 * Filter todos by status
 * Story 5.3 - AC2, AC3, AC4, Task 4: Client-side filtering logic
 *
 * @param todos - Array of all todos
 * @param filter - Filter type to apply
 * @returns Filtered todos
 */
export const filterTodos = (todos: Todo[], filter: FilterType): Todo[] => {
  switch (filter) {
    case "all":
      // AC4: Show active first, then completed
      const active = todos.filter((t) => t.status === "todo");
      const completed = todos.filter((t) => t.status === "completed");
      return [...active, ...completed];

    case "active":
      // AC2: Only incomplete todos (status='todo')
      return todos.filter((t) => t.status === "todo");

    case "completed":
      // AC3: Only completed todos, sorted by completedAt DESC (most recent first)
      return todos
        .filter((t) => t.status === "completed")
        .sort((a, b) => {
          const aTime = a.completedAt ?? 0;
          const bTime = b.completedAt ?? 0;
          return bTime - aTime; // DESC: most recent first
        });

    case "trash":
      // Pre-filtered from DB (_status = 'deleted'), passthrough
      return todos;

    default:
      return todos;
  }
};
