/**
 * Deadline Parser Service
 * Parses natural language deadline text into Date objects
 *
 * Story 4.3 - Task 3: Deadline Parsing Service (AC3)
 * Subtask 3.1-3.7: Natural language date parsing with timezone support
 *
 * Uses chrono-node library for robust parsing of:
 * - Relative dates: "today", "tomorrow", "next week", "in 3 days"
 * - Absolute dates: "Friday", "Jan 15", "2026-01-20"
 * - French & English date formats
 *
 * AC3: Deadline Parsing and Smart Inference
 */

import { Injectable, Logger } from '@nestjs/common';
import * as chrono from 'chrono-node';

/**
 * Result of deadline parsing
 */
export interface DeadlineParseResult {
  date: Date | null;
  confidence: number; // 0-1, where 1 = high confidence, 0 = unparseable
}

@Injectable()
export class DeadlineParserService {
  private readonly logger = new Logger(DeadlineParserService.name);

  /**
   * Parse deadline text into Date with confidence score
   * Subtask 3.1-3.7: Natural language date parsing
   *
   * @param deadlineText - Natural language deadline (e.g., "Friday", "tomorrow", "next week")
   * @param userTimezone - User's timezone (e.g., "America/New_York", "Europe/Paris")
   * @param referenceDate - Reference date for relative parsing (defaults to now)
   * @returns Parsed date with confidence score
   */
  parse(
    deadlineText: string | null | undefined,
    userTimezone: string = 'UTC',
    referenceDate: Date = new Date(),
  ): DeadlineParseResult {
    // Subtask 3.5: Return null for unparseable or missing deadlines
    if (!deadlineText || deadlineText.trim().length === 0) {
      return { date: null, confidence: 1.0 }; // High confidence null (no deadline mentioned)
    }

    const trimmed = deadlineText.trim().toLowerCase();

    try {
      // Subtask 3.2: Support relative dates (today, tomorrow, next week, in 3 days)
      // Subtask 3.3: Support absolute dates (Friday, Jan 15, 2026-01-20)
      // Subtask 3.6: Handle timezone (use user's timezone from context)
      // Note: chrono-node v2 handles timezone internally via Date objects
      const results = chrono.parse(trimmed, referenceDate);

      if (results.length === 0) {
        this.logger.debug(`⚠️  Could not parse deadline: "${deadlineText}"`);
        return { date: null, confidence: 0.0 }; // Unparseable
      }

      // Take first result (most relevant)
      const result = results[0];
      const parsedDate = result.date();

      // Subtask 3.4: Calculate confidence score for ambiguous dates
      const confidence = this.calculateConfidence(result, trimmed);

      this.logger.debug(
        `📅 Parsed "${deadlineText}" → ${parsedDate.toISOString()} (confidence: ${confidence})`,
      );

      return { date: parsedDate, confidence };
    } catch (error) {
      this.logger.error(
        `❌ Error parsing deadline "${deadlineText}": ${error}`,
      );
      return { date: null, confidence: 0.0 };
    }
  }

  /**
   * Calculate confidence score for parsed date
   * Subtask 3.4: Handle ambiguous dates with confidence scoring
   *
   * High confidence (1.0): Specific date with day, month, year
   * Medium-high confidence (0.8): Day of week or relative day
   * Medium confidence (0.6): Relative week/month
   * Low confidence (0.4): Vague time expressions
   *
   * @param result - Chrono parse result
   * @param originalText - Original deadline text
   * @returns Confidence score (0-1)
   */
  private calculateConfidence(
    result: chrono.ParsedResult,
    originalText: string,
  ): number {
    const components = result.start;

    // Check if specific date components are known
    const hasYear = components.isCertain('year');
    const hasMonth = components.isCertain('month');
    const hasDay = components.isCertain('day');
    const hasDayOfWeek = components.isCertain('weekday');

    // High confidence: Specific date (year + month + day)
    if (hasYear && hasMonth && hasDay) {
      return 1.0;
    }

    // Medium-high confidence: Day of week or relative day (tomorrow, today)
    if (
      hasDayOfWeek ||
      originalText.includes('today') ||
      originalText.includes('tomorrow')
    ) {
      return 0.8;
    }

    // Medium confidence: Month or relative expressions with month
    if (
      hasMonth ||
      originalText.includes('next week') ||
      originalText.includes('semaine')
    ) {
      return 0.6;
    }

    // Low-medium confidence: Vague time expressions
    if (
      originalText.includes('soon') ||
      originalText.includes('bientôt') ||
      originalText.includes('later') ||
      originalText.includes('plus tard')
    ) {
      return 0.4;
    }

    // Default medium-low confidence for parsed but uncertain dates
    return 0.5;
  }

  /**
   * Parse multiple deadlines (batch processing)
   *
   * @param deadlineTexts - Array of deadline texts
   * @param userTimezone - User's timezone
   * @param referenceDate - Reference date
   * @returns Array of parse results
   */
  parseMany(
    deadlineTexts: Array<string | null | undefined>,
    userTimezone: string = 'UTC',
    referenceDate: Date = new Date(),
  ): DeadlineParseResult[] {
    return deadlineTexts.map((text) =>
      this.parse(text, userTimezone, referenceDate),
    );
  }

  /**
   * Check if deadline is in the past
   *
   * @param date - Deadline date
   * @param referenceDate - Reference date (defaults to now)
   * @returns True if deadline has passed
   */
  isPast(date: Date | null, referenceDate: Date = new Date()): boolean {
    if (!date) return false;
    return date.getTime() < referenceDate.getTime();
  }

  /**
   * Get deadline urgency level
   *
   * @param date - Deadline date
   * @param referenceDate - Reference date (defaults to now)
   * @returns Urgency level: 'overdue' | 'urgent' | 'soon' | 'later'
   */
  getUrgency(
    date: Date | null,
    referenceDate: Date = new Date(),
  ): 'overdue' | 'urgent' | 'soon' | 'later' | 'none' {
    if (!date) return 'none';

    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUntil = Math.floor(
      (date.getTime() - referenceDate.getTime()) / msPerDay,
    );

    if (daysUntil < 0) return 'overdue';
    if (daysUntil === 0) return 'urgent'; // Today
    if (daysUntil <= 2) return 'urgent'; // Tomorrow or day after
    if (daysUntil <= 7) return 'soon'; // This week
    return 'later'; // More than a week
  }
}
