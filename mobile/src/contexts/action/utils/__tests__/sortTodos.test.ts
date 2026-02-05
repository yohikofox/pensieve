import { sortTodos, isSectionData, SortType } from '../sortTodos';
import { Todo } from '../../domain/Todo.model';
import { TodoSection } from '../groupTodosByDeadline';

// Mock groupTodosByDeadline since it's tested separately
jest.mock('../groupTodosByDeadline', () => ({
  groupTodosByDeadline: jest.fn((todos) => {
    // Simple mock: just return sections with all todos in "today" group
    return [
      {
        title: "Aujourd'hui",
        data: todos,
      },
    ];
  }),
}));

describe('sortTodos', () => {
  const now = Date.now();
  const mockTodos: Todo[] = [
    {
      id: '1',
      thoughtId: 'thought-1',
      ideaId: 'idea-1',
      captureId: 'capture-1',
      userId: 'user-1',
      description: 'Charlie task',
      status: 'todo',
      priority: 'low',
      deadline: now + 3 * 24 * 60 * 60 * 1000, // +3 days
      createdAt: now - 3000,
      updatedAt: now,
    },
    {
      id: '2',
      thoughtId: 'thought-2',
      ideaId: 'idea-2',
      captureId: 'capture-2',
      userId: 'user-1',
      description: 'Alpha task',
      status: 'todo',
      priority: 'high',
      deadline: now + 1 * 24 * 60 * 60 * 1000, // +1 day
      createdAt: now - 1000, // Most recent
      updatedAt: now,
    },
    {
      id: '3',
      thoughtId: 'thought-3',
      ideaId: 'idea-3',
      captureId: 'capture-3',
      userId: 'user-1',
      description: 'Bravo task',
      status: 'todo',
      priority: 'medium',
      deadline: now + 2 * 24 * 60 * 60 * 1000, // +2 days
      createdAt: now - 2000,
      updatedAt: now,
    },
    {
      id: '4',
      thoughtId: 'thought-4',
      ideaId: 'idea-4',
      captureId: 'capture-4',
      userId: 'user-1',
      description: 'Delta task',
      status: 'todo',
      priority: 'high',
      deadline: undefined, // No deadline
      createdAt: now - 4000, // Oldest
      updatedAt: now,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Sort: default', () => {
    it('should call groupTodosByDeadline', () => {
      const { groupTodosByDeadline } = require('../groupTodosByDeadline');
      const result = sortTodos(mockTodos, 'default');

      expect(groupTodosByDeadline).toHaveBeenCalledTimes(1);
      expect(groupTodosByDeadline).toHaveBeenCalledWith(mockTodos);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect((result as TodoSection[])[0].title).toBe("Aujourd'hui");
    });

    it('should return sections (TodoSection[])', () => {
      const result = sortTodos(mockTodos, 'default');
      expect(isSectionData(result)).toBe(true);
    });
  });

  describe('Sort: priority', () => {
    it('should sort by priority High → Medium → Low', () => {
      const result = sortTodos(mockTodos, 'priority') as Todo[];

      expect(result).toHaveLength(4);
      // High priority first (id='2' and id='4')
      expect(result[0].priority).toBe('high');
      expect(result[1].priority).toBe('high');
      // Medium priority (id='3')
      expect(result[2].priority).toBe('medium');
      // Low priority (id='1')
      expect(result[3].priority).toBe('low');
    });

    it('should use deadline as secondary sort within same priority', () => {
      const result = sortTodos(mockTodos, 'priority') as Todo[];

      // Two high priority todos: id='2' (deadline +1 day) and id='4' (no deadline)
      // id='2' should come first (has earlier deadline)
      const highPriorityTodos = result.filter((t) => t.priority === 'high');
      expect(highPriorityTodos).toHaveLength(2);
      expect(highPriorityTodos[0].id).toBe('2'); // Has deadline
      expect(highPriorityTodos[1].id).toBe('4'); // No deadline (Infinity)
    });

    it('should handle todos with no deadline (sort to end)', () => {
      const todosWithoutDeadline: Todo[] = [
        {
          ...mockTodos[0],
          id: '5',
          deadline: undefined,
          priority: 'medium',
        },
        {
          ...mockTodos[0],
          id: '6',
          deadline: now + 1000,
          priority: 'medium',
        },
      ];

      const result = sortTodos(todosWithoutDeadline, 'priority') as Todo[];

      expect(result[0].id).toBe('6'); // Has deadline
      expect(result[1].id).toBe('5'); // No deadline
    });

    it('should not mutate original array', () => {
      const originalTodos = [...mockTodos];
      sortTodos(mockTodos, 'priority');

      expect(mockTodos).toEqual(originalTodos);
    });

    it('should return flat array (not sections)', () => {
      const result = sortTodos(mockTodos, 'priority');
      expect(isSectionData(result)).toBe(false);
    });
  });

  describe('Sort: createdDate', () => {
    it('should sort by createdAt DESC (newest first)', () => {
      const result = sortTodos(mockTodos, 'createdDate') as Todo[];

      expect(result).toHaveLength(4);
      // Most recent: id='2' (now - 1000)
      expect(result[0].id).toBe('2');
      expect(result[0].createdAt).toBe(now - 1000);
      // id='3' (now - 2000)
      expect(result[1].id).toBe('3');
      // id='1' (now - 3000)
      expect(result[2].id).toBe('1');
      // Oldest: id='4' (now - 4000)
      expect(result[3].id).toBe('4');
      expect(result[3].createdAt).toBe(now - 4000);
    });

    it('should not mutate original array', () => {
      const originalTodos = [...mockTodos];
      sortTodos(mockTodos, 'createdDate');

      expect(mockTodos).toEqual(originalTodos);
    });

    it('should return flat array (not sections)', () => {
      const result = sortTodos(mockTodos, 'createdDate');
      expect(isSectionData(result)).toBe(false);
    });
  });

  describe('Sort: alphabetical', () => {
    it('should sort by description ASC (A-Z)', () => {
      const result = sortTodos(mockTodos, 'alphabetical') as Todo[];

      expect(result).toHaveLength(4);
      // Alphabetical order: Alpha → Bravo → Charlie → Delta
      expect(result[0].description).toBe('Alpha task');
      expect(result[1].description).toBe('Bravo task');
      expect(result[2].description).toBe('Charlie task');
      expect(result[3].description).toBe('Delta task');
    });

    it('should use French locale for comparison', () => {
      const frenchTodos: Todo[] = [
        {
          ...mockTodos[0],
          id: '7',
          description: 'Être', // É should come before E in French
        },
        {
          ...mockTodos[0],
          id: '8',
          description: 'Ecole',
        },
      ];

      const result = sortTodos(frenchTodos, 'alphabetical') as Todo[];

      // With French locale and base sensitivity, "Être" and "Ecole" should be close
      // This test validates locale is applied (exact order depends on locale rules)
      expect(result).toHaveLength(2);
      expect(result[0].description).toBe('Ecole');
      expect(result[1].description).toBe('Être');
    });

    it('should be case-insensitive (sensitivity: base)', () => {
      const mixedCaseTodos: Todo[] = [
        {
          ...mockTodos[0],
          id: '9',
          description: 'apple',
        },
        {
          ...mockTodos[0],
          id: '10',
          description: 'BANANA',
        },
        {
          ...mockTodos[0],
          id: '11',
          description: 'Cherry',
        },
      ];

      const result = sortTodos(mixedCaseTodos, 'alphabetical') as Todo[];

      expect(result[0].description).toBe('apple');
      expect(result[1].description).toBe('BANANA');
      expect(result[2].description).toBe('Cherry');
    });

    it('should not mutate original array', () => {
      const originalTodos = [...mockTodos];
      sortTodos(mockTodos, 'alphabetical');

      expect(mockTodos).toEqual(originalTodos);
    });

    it('should return flat array (not sections)', () => {
      const result = sortTodos(mockTodos, 'alphabetical');
      expect(isSectionData(result)).toBe(false);
    });
  });

  describe('Default case', () => {
    it('should return todos unchanged for unknown sort type', () => {
      // @ts-expect-error Testing invalid sort type
      const result = sortTodos(mockTodos, 'invalid' as SortType);

      expect(result).toEqual(mockTodos);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty array', () => {
      const resultDefault = sortTodos([], 'default');
      expect(resultDefault).toEqual([{ title: "Aujourd'hui", data: [] }]);

      const resultPriority = sortTodos([], 'priority');
      expect(resultPriority).toEqual([]);

      const resultCreatedDate = sortTodos([], 'createdDate');
      expect(resultCreatedDate).toEqual([]);

      const resultAlphabetical = sortTodos([], 'alphabetical');
      expect(resultAlphabetical).toEqual([]);
    });

    it('should handle single todo', () => {
      const singleTodo = [mockTodos[0]];

      const resultPriority = sortTodos(singleTodo, 'priority');
      expect(resultPriority).toHaveLength(1);

      const resultCreatedDate = sortTodos(singleTodo, 'createdDate');
      expect(resultCreatedDate).toHaveLength(1);

      const resultAlphabetical = sortTodos(singleTodo, 'alphabetical');
      expect(resultAlphabetical).toHaveLength(1);
    });
  });
});

describe('isSectionData', () => {
  it('should return true for TodoSection[]', () => {
    const sections: TodoSection[] = [
      { title: 'Section 1', data: [] },
      { title: 'Section 2', data: [] },
    ];

    expect(isSectionData(sections)).toBe(true);
  });

  it('should return false for Todo[]', () => {
    const todos: Todo[] = [
      {
        id: '1',
        thoughtId: 'thought-1',
        ideaId: 'idea-1',
        captureId: 'capture-1',
        userId: 'user-1',
        description: 'Todo 1',
        status: 'todo',
        priority: 'high',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    expect(isSectionData(todos)).toBe(false);
  });

  it('should return false for empty array', () => {
    const emptyArray: any[] = [];

    expect(isSectionData(emptyArray)).toBe(false);
  });

  it('should return false for non-array', () => {
    const notArray = { title: 'Not an array', data: [] };

    // @ts-expect-error Testing invalid input
    expect(isSectionData(notArray)).toBe(false);
  });
});
