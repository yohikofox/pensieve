/**
 * groupTodosByDeadline Utility
 * Story 5.2 - Subtask 4.1-4.5: Group todos by deadline buckets for SectionList
 *
 * AC3: Default grouping - Overdue → Today → This Week → Later → No Deadline
 * Within each group: sorted by priority (High → Medium → Low)
 */

import { startOfDay, endOfWeek, isSameDay, isWithinInterval } from 'date-fns';
import { Todo } from '../domain/Todo.model';

export interface TodoSection {
  title: string;
  data: Todo[];
}

/**
 * Group todos by deadline buckets and sort within groups
 * @param todos - Array of todos to group
 * @returns Array of sections for SectionList
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
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  };

  Object.keys(groups).forEach((key) => {
    groups[key].sort(sortByPriority);
  });

  // Return sections array for SectionList, filtering empty sections
  return [
    { title: 'En retard', data: groups.overdue },
    { title: "Aujourd'hui", data: groups.today },
    { title: 'Cette semaine', data: groups.thisWeek },
    { title: 'Plus tard', data: groups.later },
    { title: "Pas d'échéance", data: groups.noDeadline },
  ].filter((section) => section.data.length > 0);
};
