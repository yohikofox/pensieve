/**
 * groupTodosByDeadline Unit Tests
 * Story 5.2 - Subtask 4.6: Test grouping logic with various scenarios
 *
 * Code Review Fix #10: Updated tests for i18n
 */

import { addDays, startOfDay, endOfWeek, subDays } from 'date-fns';
import { Todo } from '../../domain/Todo.model';
import { groupTodosByDeadline } from '../groupTodosByDeadline';

// Mock i18n
jest.mock('i18next', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'actions.groups.overdue': 'En retard',
      'actions.groups.today': "Aujourd'hui",
      'actions.groups.thisWeek': 'Cette semaine',
      'actions.groups.later': 'Plus tard',
      'actions.groups.noDeadline': "Pas d'échéance",
    };
    return translations[key] || key;
  },
}));

// Helper to create a test todo
const createTodo = (
  description: string,
  deadline: number | undefined,
  priority: 'low' | 'medium' | 'high'
): Todo => ({
  id: Math.random().toString(),
  thoughtId: 'thought-1',
  ideaId: 'idea-1',
  captureId: 'capture-1',
  userId: 'user-1',
  description,
  status: 'todo',
  deadline,
  priority,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

describe('groupTodosByDeadline', () => {
  const today = startOfDay(Date.now()).getTime();
  const yesterday = subDays(today, 1).getTime();
  const tomorrow = addDays(today, 1).getTime();
  const thisWeekEnd = endOfWeek(today, { weekStartsOn: 1 }).getTime() - 24 * 60 * 60 * 1000; // Before end of week
  const nextWeek = addDays(endOfWeek(today, { weekStartsOn: 1 }), 2).getTime(); // After this week
  const nextMonth = addDays(today, 30).getTime();

  it('should group overdue todos correctly', () => {
    const todos: Todo[] = [
      createTodo('Overdue task', yesterday, 'high'),
      createTodo('Today task', today, 'medium'),
    ];

    const sections = groupTodosByDeadline(todos);

    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('En retard');
    expect(sections[0].data).toHaveLength(1);
    expect(sections[0].data[0].description).toBe('Overdue task');
  });

  it('should group today todos correctly', () => {
    const todos: Todo[] = [
      createTodo('Today task 1', today, 'high'),
      createTodo('Today task 2', today, 'low'),
    ];

    const sections = groupTodosByDeadline(todos);

    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Aujourd'hui");
    expect(sections[0].data).toHaveLength(2);
  });

  it('should group this week todos correctly', () => {
    const todos: Todo[] = [
      createTodo('Tomorrow task', tomorrow, 'medium'),
      createTodo('This week end task', thisWeekEnd, 'high'),
    ];

    const sections = groupTodosByDeadline(todos);

    const thisWeekSection = sections.find((s) => s.title === 'Cette semaine');
    expect(thisWeekSection).toBeDefined();
    expect(thisWeekSection!.data.length).toBe(2);
  });

  it('should group later todos correctly', () => {
    const todos: Todo[] = [createTodo('Next month task', nextMonth, 'low')];

    const sections = groupTodosByDeadline(todos);

    const laterSection = sections.find((s) => s.title === 'Plus tard');
    expect(laterSection).toBeDefined();
    expect(laterSection!.data).toHaveLength(1);
  });

  it('should group todos without deadline', () => {
    const todos: Todo[] = [
      createTodo('No deadline task 1', undefined, 'high'),
      createTodo('No deadline task 2', undefined, 'medium'),
    ];

    const sections = groupTodosByDeadline(todos);

    const noDeadlineSection = sections.find((s) => s.title === "Pas d'échéance");
    expect(noDeadlineSection).toBeDefined();
    expect(noDeadlineSection!.data).toHaveLength(2);
  });

  it('should sort by priority within each group (High → Medium → Low)', () => {
    const todos: Todo[] = [
      createTodo('Low priority', today, 'low'),
      createTodo('High priority', today, 'high'),
      createTodo('Medium priority', today, 'medium'),
    ];

    const sections = groupTodosByDeadline(todos);

    const todaySection = sections.find((s) => s.title === "Aujourd'hui");
    expect(todaySection).toBeDefined();
    expect(todaySection!.data[0].description).toBe('High priority');
    expect(todaySection!.data[1].description).toBe('Medium priority');
    expect(todaySection!.data[2].description).toBe('Low priority');
  });

  it('should filter out empty sections', () => {
    const todos: Todo[] = [createTodo('Only today task', today, 'high')];

    const sections = groupTodosByDeadline(todos);

    // Should only have "Aujourd'hui" section, others should be filtered out
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Aujourd'hui");
  });

  it('should handle empty todos array', () => {
    const todos: Todo[] = [];

    const sections = groupTodosByDeadline(todos);

    expect(sections).toHaveLength(0);
  });

  it('should group all deadline buckets correctly in a mixed list', () => {
    const todos: Todo[] = [
      createTodo('Overdue', yesterday, 'high'),
      createTodo('Today', today, 'medium'),
      createTodo('This week', thisWeekEnd, 'low'),
      createTodo('Later', nextWeek, 'high'),
      createTodo('No deadline', undefined, 'medium'),
    ];

    const sections = groupTodosByDeadline(todos);

    expect(sections).toHaveLength(5);
    expect(sections[0].title).toBe('En retard');
    expect(sections[1].title).toBe("Aujourd'hui");
    expect(sections[2].title).toBe('Cette semaine');
    expect(sections[3].title).toBe('Plus tard');
    expect(sections[4].title).toBe("Pas d'échéance");
  });
});
