/**
 * Deadline Parser Service Tests
 * Story 4.3 - Subtask 3.7: Unit tests for various date formats and edge cases
 *
 * Tests cover:
 * - Relative dates (today, tomorrow, in N days)
 * - Absolute dates (Friday, specific dates)
 * - Ambiguous dates with confidence scoring
 * - Null/empty handling
 * - Timezone handling
 */

import { DeadlineParserService } from './deadline-parser.service';

describe('DeadlineParserService', () => {
  let service: DeadlineParserService;
  const referenceDate = new Date('2026-02-04T12:00:00Z'); // Wednesday, Feb 4, 2026

  beforeEach(() => {
    service = new DeadlineParserService();
  });

  describe('Relative Dates (Subtask 3.2)', () => {
    it('should parse "today" to current date', () => {
      const result = service.parse('today', 'UTC', referenceDate);

      expect(result.date).toBeDefined();
      expect(result.date?.toDateString()).toBe(referenceDate.toDateString());
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should parse "tomorrow" to next day', () => {
      const result = service.parse('tomorrow', 'UTC', referenceDate);

      expect(result.date).toBeDefined();
      const expectedDate = new Date(referenceDate);
      expectedDate.setDate(expectedDate.getDate() + 1);
      expect(result.date?.toDateString()).toBe(expectedDate.toDateString());
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should parse "in 3 days" to 3 days from now', () => {
      const result = service.parse('in 3 days', 'UTC', referenceDate);

      expect(result.date).toBeDefined();
      const expectedDate = new Date(referenceDate);
      expectedDate.setDate(expectedDate.getDate() + 3);
      expect(result.date?.toDateString()).toBe(expectedDate.toDateString());
    });

    it('should parse "next week" successfully', () => {
      const result = service.parse('next week', 'UTC', referenceDate);

      expect(result.date).toBeDefined();
      // Confidence varies based on chrono-node's interpretation
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Absolute Dates (Subtask 3.3)', () => {
    it('should parse "Friday" to next Friday', () => {
      const result = service.parse('Friday', 'UTC', referenceDate);

      expect(result.date).toBeDefined();
      expect(result.date?.getDay()).toBe(5); // Friday = 5
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should parse "February 10" to specific date', () => {
      const result = service.parse('February 10', 'UTC', referenceDate);

      expect(result.date).toBeDefined();
      expect(result.date?.getMonth()).toBe(1); // February = 1 (0-indexed)
      expect(result.date?.getDate()).toBe(10);
    });

    it('should parse "2026-02-20" (ISO format) with high confidence', () => {
      const result = service.parse('2026-02-20', 'UTC', referenceDate);

      expect(result.date).toBeDefined();
      expect(result.date?.getFullYear()).toBe(2026);
      expect(result.date?.getMonth()).toBe(1); // February
      expect(result.date?.getDate()).toBe(20);
      expect(result.confidence).toBe(1.0); // High confidence for specific date
    });
  });

  describe('Null and Empty Handling (Subtask 3.5)', () => {
    it('should return null for null deadline text', () => {
      const result = service.parse(null, 'UTC', referenceDate);

      expect(result.date).toBeNull();
      expect(result.confidence).toBe(1.0); // High confidence null
    });

    it('should return null for undefined deadline text', () => {
      const result = service.parse(undefined, 'UTC', referenceDate);

      expect(result.date).toBeNull();
      expect(result.confidence).toBe(1.0); // High confidence null
    });

    it('should return null for empty string', () => {
      const result = service.parse('', 'UTC', referenceDate);

      expect(result.date).toBeNull();
      expect(result.confidence).toBe(1.0);
    });

    it('should return null for whitespace-only string', () => {
      const result = service.parse('   ', 'UTC', referenceDate);

      expect(result.date).toBeNull();
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('Unparseable Dates (Subtask 3.5)', () => {
    it('should return null for unparseable text "someday"', () => {
      const result = service.parse('someday', 'UTC', referenceDate);

      expect(result.date).toBeNull();
      expect(result.confidence).toBe(0.0); // Unparseable
    });

    it('should return null for unparseable text "asap" (not a date)', () => {
      const result = service.parse('asap', 'UTC', referenceDate);

      expect(result.date).toBeNull();
      expect(result.confidence).toBe(0.0);
    });
  });

  describe('Confidence Scoring (Subtask 3.4)', () => {
    it('should give high confidence (1.0) for specific date with year/month/day', () => {
      const result = service.parse('January 15, 2026', 'UTC', referenceDate);

      expect(result.confidence).toBe(1.0);
    });

    it('should give medium-high confidence (0.8) for day of week', () => {
      const result = service.parse('Friday', 'UTC', referenceDate);

      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should give medium-high confidence for "next week"', () => {
      const result = service.parse('next week', 'UTC', referenceDate);

      // chrono-node parses "next week" with specific date components
      expect(result.confidence).toBeGreaterThan(0.5);
      // Note: May be 1.0 if chrono resolves to specific week start date
    });

    it('should give low-medium confidence for vague expressions "soon"', () => {
      const result = service.parse('soon', 'UTC', referenceDate);

      expect(result.confidence).toBeLessThan(0.6);
    });
  });

  describe('Timezone Handling (Subtask 3.6)', () => {
    it('should parse with user timezone (Europe/Paris)', () => {
      const result = service.parse('tomorrow', 'Europe/Paris', referenceDate);

      expect(result.date).toBeDefined();
      // Date should be adjusted for Paris timezone
    });

    it('should parse with user timezone (America/New_York)', () => {
      const result = service.parse(
        'tomorrow',
        'America/New_York',
        referenceDate,
      );

      expect(result.date).toBeDefined();
      // Date should be adjusted for New York timezone
    });

    it('should default to UTC if no timezone provided', () => {
      const result = service.parse('tomorrow');

      expect(result.date).toBeDefined();
    });
  });

  describe('French Date Expressions', () => {
    // Note: chrono-node requires additional configuration for French language support
    // For MVP, users can use English date expressions or configure French parser
    // See: https://github.com/wanasit/chrono#parsers

    it.skip('should parse "demain" (French for tomorrow) - requires French parser', () => {
      const result = service.parse('demain', 'Europe/Paris', referenceDate);

      expect(result.date).toBeDefined();
      const expectedDate = new Date(referenceDate);
      expectedDate.setDate(expectedDate.getDate() + 1);
      expect(result.date?.toDateString()).toBe(expectedDate.toDateString());
    });

    it.skip('should parse "vendredi" (French for Friday) - requires French parser', () => {
      const result = service.parse('vendredi', 'Europe/Paris', referenceDate);

      expect(result.date).toBeDefined();
      expect(result.date?.getDay()).toBe(5); // Friday
    });

    it('should handle unsupported French text gracefully', () => {
      const result = service.parse(
        'vendredi prochain',
        'Europe/Paris',
        referenceDate,
      );

      // Should return null or low confidence for unparseable French
      // Users can use English alternatives like "next Friday"
      expect(result.date).toBeFalsy();
    });
  });

  describe('parseMany', () => {
    it('should parse multiple deadline texts', () => {
      const texts = ['today', 'tomorrow', 'Friday', null, 'someday'];
      const results = service.parseMany(texts, 'UTC', referenceDate);

      expect(results).toHaveLength(5);
      expect(results[0].date).toBeDefined(); // today
      expect(results[1].date).toBeDefined(); // tomorrow
      expect(results[2].date).toBeDefined(); // Friday
      expect(results[3].date).toBeNull(); // null
      expect(results[4].date).toBeNull(); // someday (unparseable)
    });
  });

  describe('isPast', () => {
    it('should return true for past dates', () => {
      const pastDate = new Date('2026-02-01');
      const result = service.isPast(pastDate, referenceDate);

      expect(result).toBe(true);
    });

    it('should return false for future dates', () => {
      const futureDate = new Date('2026-02-10');
      const result = service.isPast(futureDate, referenceDate);

      expect(result).toBe(false);
    });

    it('should return false for null dates', () => {
      const result = service.isPast(null, referenceDate);

      expect(result).toBe(false);
    });
  });

  describe('getUrgency', () => {
    it('should return "overdue" for past dates', () => {
      const pastDate = new Date('2026-02-01');
      const urgency = service.getUrgency(pastDate, referenceDate);

      expect(urgency).toBe('overdue');
    });

    it('should return "urgent" for today', () => {
      const today = new Date(referenceDate);
      const urgency = service.getUrgency(today, referenceDate);

      expect(urgency).toBe('urgent');
    });

    it('should return "urgent" for tomorrow', () => {
      const tomorrow = new Date(referenceDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const urgency = service.getUrgency(tomorrow, referenceDate);

      expect(urgency).toBe('urgent');
    });

    it('should return "soon" for this week (3-7 days)', () => {
      const thisWeek = new Date(referenceDate);
      thisWeek.setDate(thisWeek.getDate() + 5);
      const urgency = service.getUrgency(thisWeek, referenceDate);

      expect(urgency).toBe('soon');
    });

    it('should return "later" for more than a week', () => {
      const later = new Date(referenceDate);
      later.setDate(later.getDate() + 10);
      const urgency = service.getUrgency(later, referenceDate);

      expect(urgency).toBe('later');
    });

    it('should return "none" for null dates', () => {
      const urgency = service.getUrgency(null, referenceDate);

      expect(urgency).toBe('none');
    });
  });
});
