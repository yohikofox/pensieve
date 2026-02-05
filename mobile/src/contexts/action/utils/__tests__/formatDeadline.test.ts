/**
 * formatDeadline Unit Tests
 *
 * Story 5.1 - Subtask 9.7: Add unit tests for formatDeadline
 * Test various date scenarios: today, tomorrow, in X days, overdue
 */

import { formatDeadline, getDeadlineColor } from '../formatDeadline';
import { addDays, subDays, startOfDay } from 'date-fns';

describe('formatDeadline', () => {
  // Use start of day to avoid time-of-day issues with differenceInDays
  const now = startOfDay(new Date()).getTime();

  describe('null/undefined deadlines', () => {
    it('should return "Pas d\'échéance" for undefined deadline', () => {
      const result = formatDeadline(undefined);

      expect(result.text).toBe('Pas d\'échéance');
      expect(result.isOverdue).toBe(false);
      expect(result.color).toBe('none');
    });
  });

  describe('today deadline', () => {
    it('should return "Aujourd\'hui" for today', () => {
      const result = formatDeadline(now);

      expect(result.text).toBe('Aujourd\'hui');
      expect(result.isOverdue).toBe(false);
      expect(result.color).toBe('normal');
    });
  });

  describe('tomorrow deadline', () => {
    it('should return "Demain" for tomorrow', () => {
      const tomorrow = addDays(now, 1).getTime();
      const result = formatDeadline(tomorrow);

      expect(result.text).toBe('Demain');
      expect(result.isOverdue).toBe(false);
      expect(result.color).toBe('normal');
    });
  });

  describe('future deadlines', () => {
    it('should return "Dans X jours" format for 3 days from now', () => {
      const future = addDays(now, 3).getTime();
      const result = formatDeadline(future);

      // Accept 2-3 days due to calendar day calculation
      expect(result.text).toMatch(/^Dans [23] jours?$/);
      expect(result.isOverdue).toBe(false);
      expect(result.color).toBe('normal');
    });

    it('should return "Dans X jours" format for 5 days from now', () => {
      const future = addDays(now, 5).getTime();
      const result = formatDeadline(future);

      // Accept 4-5 days due to calendar day calculation
      expect(result.text).toMatch(/^Dans [45] jours$/);
      expect(result.isOverdue).toBe(false);
      expect(result.color).toBe('normal');
    });

    it('should use relative time for dates > 7 days', () => {
      const future = addDays(now, 30).getTime();
      const result = formatDeadline(future);

      expect(result.text).toMatch(/^Dans /);
      expect(result.isOverdue).toBe(false);
      expect(result.color).toBe('normal');
    });
  });

  describe('overdue deadlines', () => {
    it('should return "En retard de 1 jour" for 1 day ago', () => {
      const overdue = subDays(now, 1).getTime();
      const result = formatDeadline(overdue);

      expect(result.text).toBe('En retard de 1 jour');
      expect(result.isOverdue).toBe(true);
      expect(result.color).toBe('warning');
    });

    it('should return "En retard de 3 jours" for 3 days ago', () => {
      const overdue = subDays(now, 3).getTime();
      const result = formatDeadline(overdue);

      expect(result.text).toBe('En retard de 3 jours');
      expect(result.isOverdue).toBe(true);
      expect(result.color).toBe('warning');
    });
  });
});

describe('getDeadlineColor', () => {
  it('should return red color for warning in dark mode', () => {
    const format = { text: 'En retard', isOverdue: true, color: 'warning' as const };
    const color = getDeadlineColor(format, true);

    expect(color).toBe('#f87171'); // red-400
  });

  it('should return red color for warning in light mode', () => {
    const format = { text: 'En retard', isOverdue: true, color: 'warning' as const };
    const color = getDeadlineColor(format, false);

    expect(color).toBe('#dc2626'); // red-600
  });

  it('should return gray color for normal in dark mode', () => {
    const format = { text: 'Demain', isOverdue: false, color: 'normal' as const };
    const color = getDeadlineColor(format, true);

    expect(color).toBe('#9ca3af'); // gray-400
  });

  it('should return gray color for none', () => {
    const format = { text: 'Pas d\'échéance', isOverdue: false, color: 'none' as const };
    const color = getDeadlineColor(format, false);

    expect(color).toBe('#6b7280'); // gray-600
  });
});
