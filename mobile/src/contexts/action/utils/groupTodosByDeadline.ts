/**
 * groupTodosByDeadline Utility
 * Story 5.2 - Subtask 4.1-4.5: Group todos by deadline buckets for SectionList
 *
 * AC3: Default grouping - Overdue → Today → This Week → Later → No Deadline
 * Within each group: sorted by priority (High → Medium → Low)
 *
 * Code Review Fix #10: Internationalized group titles
 * - Uses i18n keys instead of hardcoded French strings
 * - Allows translation to other languages (English, etc.)
 */

import { startOfDay, endOfWeek, isSameDay, isWithinInterval } from "date-fns";
import { Todo } from "../domain/Todo.model";
import i18n from "i18next";

export interface TodoSection {
  title: string;
  data: Todo[];
}

/**
 * Group todos by deadline buckets and sort within groups
 *
 * @param todos - Array of todos to group
 * @returns Array of sections for SectionList, filtered to remove empty groups
 *
 * @example
 * ```typescript
 * const todos = [
 *   { id: '1', deadline: Date.now() - 86400000, priority: 'high', ... }, // Yesterday
 *   { id: '2', deadline: Date.now(), priority: 'medium', ... },           // Today
 * ];
 * const sections = groupTodosByDeadline(todos);
 * // Returns:
 * // [
 * //   { title: 'En retard', data: [todo1] },
 * //   { title: "Aujourd'hui", data: [todo2] },
 * // ]
 * ```
 */
export const groupTodosByDeadline = (todos: Todo[]): TodoSection[] => {
  const now = Date.now();
  const today = startOfDay(now);
  const endOfThisWeek = endOfWeek(today, { weekStartsOn: 1 }); // Monday start

  const groups: Record<string, Todo[]> = {
    overdue: [],
    today: [],
    thisWeek: [],
    later: [],
    noDeadline: [],
  };

  // Group todos by deadline bucket
  todos.forEach((todo) => {
    if (!todo.deadline) {
      groups.noDeadline.push(todo);
    } else if (todo.deadline < today.getTime()) {
      groups.overdue.push(todo);
    } else if (isSameDay(todo.deadline, today)) {
      groups.today.push(todo);
    } else if (
      isWithinInterval(todo.deadline, {
        start: today.getTime() + 24 * 60 * 60 * 1000, // Tomorrow
        end: endOfThisWeek,
      })
    ) {
      groups.thisWeek.push(todo);
    } else {
      groups.later.push(todo);
    }
  });

  // Sort within each group by priority (High → Medium → Low)
  const sortByPriority = (a: Todo, b: Todo) => {
    const priorityOrder: Record<string, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  };

  Object.keys(groups).forEach((key) => {
    groups[key].sort(sortByPriority);
  });

  // Return sections array for SectionList, filtering empty sections
  // Code Review Fix #10: Use i18n translations instead of hardcoded strings
  return [
    { title: i18n.t("actions.groups.overdue"), data: groups.overdue },
    { title: i18n.t("actions.groups.today"), data: groups.today },
    { title: i18n.t("actions.groups.thisWeek"), data: groups.thisWeek },
    { title: i18n.t("actions.groups.later"), data: groups.later },
    { title: i18n.t("actions.groups.noDeadline"), data: groups.noDeadline },
  ].filter((section) => section.data.length > 0);
};
