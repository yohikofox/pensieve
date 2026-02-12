/**
 * Response Parsing Logic Unit Tests
 * Tests for Task 5.7: Unit tests for response parsing logic
 *
 * Tests GPT response parsing, JSON handling, and fallback mechanisms
 */

import { validateDigestionResponse } from '../../domain/schemas/digestion-response.schema';

describe('Response Parsing Logic (Task 5.7)', () => {
  describe('JSON Response Parsing', () => {
    it('should parse valid JSON response correctly', () => {
      // Arrange
      const jsonResponse = JSON.stringify({
        summary: 'This is a valid summary that meets the length requirements.',
        ideas: ['First idea', 'Second idea', 'Third idea'],
        confidence: 'high',
      });

      // Act
      const parsed = JSON.parse(jsonResponse);
      const validated = validateDigestionResponse(parsed);

      // Assert
      expect(validated.summary).toBe(
        'This is a valid summary that meets the length requirements.',
      );
      expect(validated.ideas).toHaveLength(3);
      expect(validated.confidence).toBe('high');
    });

    it('should handle response with default confidence when not provided', () => {
      // Arrange
      const jsonResponse = JSON.stringify({
        summary: 'Summary without confidence level specified',
        ideas: ['Idea one', 'Idea two'],
      });

      // Act
      const parsed = JSON.parse(jsonResponse);
      const validated = validateDigestionResponse(parsed);

      // Assert
      expect(validated.confidence).toBe('high'); // Default value
    });

    it('should handle ideas array with varying lengths', () => {
      // Arrange
      const jsonResponse = JSON.stringify({
        summary: 'Summary for testing variable idea lengths',
        ideas: [
          'Short',
          'Medium length idea with more details',
          'Very long idea that contains multiple sentences and detailed explanation of a complex concept that was identified in the original content',
        ],
        confidence: 'medium',
      });

      // Act
      const parsed = JSON.parse(jsonResponse);
      const validated = validateDigestionResponse(parsed);

      // Assert
      expect(validated.ideas).toHaveLength(3);
      expect(validated.ideas[0].length).toBeGreaterThanOrEqual(5);
      expect(validated.ideas[2].length).toBeLessThanOrEqual(200);
    });
  });

  describe('Plain Text Response Parsing (Fallback)', () => {
    it('should parse plain text summary when JSON parsing fails', () => {
      // Arrange - Plain text response (not JSON)
      const plainTextResponse = `
Summary: This is a plain text summary that needs to be extracted from the response.

Key Ideas:
- First important idea from the content
- Second key insight identified
- Third actionable point to remember
      `.trim();

      // Act - Manual parsing (simulating fallback logic)
      const summaryMatch = plainTextResponse.match(
        /Summary:\s*(.+?)(?=\n\n|$)/s,
      );
      const ideasMatch = plainTextResponse.match(
        /Key Ideas:\s*\n((?:- .+\n?)+)/,
      );

      const summary = summaryMatch ? summaryMatch[1].trim() : '';
      const ideas = ideasMatch
        ? ideasMatch[1]
            .split('\n')
            .filter((line) => line.startsWith('- '))
            .map((line) => line.replace(/^- /, '').trim())
        : [];

      // Assert
      expect(summary).toBe(
        'This is a plain text summary that needs to be extracted from the response.',
      );
      expect(ideas).toHaveLength(3);
      expect(ideas[0]).toBe('First important idea from the content');
    });

    it('should handle malformed plain text responses gracefully', () => {
      // Arrange - Malformed response
      const malformedResponse = `
Some text without proper structure
Random content here
No clear summary or ideas section
      `.trim();

      // Act - Attempt to extract
      const summaryMatch = malformedResponse.match(
        /Summary:\s*(.+?)(?=\n\n|$)/s,
      );
      const ideasMatch = malformedResponse.match(
        /Key Ideas:\s*\n((?:- .+\n?)+)/,
      );

      // Assert - Should return empty/default values
      expect(summaryMatch).toBeNull();
      expect(ideasMatch).toBeNull();
    });

    it('should extract summary and ideas from markdown-formatted response', () => {
      // Arrange - Markdown format
      const markdownResponse = `
## Summary
This is a markdown formatted summary with proper structure.

## Key Ideas
- Idea formatted in markdown style
- Another bullet point insight
- Final key takeaway
      `.trim();

      // Act
      const summaryMatch = markdownResponse.match(
        /## Summary\s*\n(.+?)(?=\n##|$)/s,
      );
      const ideasMatch = markdownResponse.match(
        /## Key Ideas\s*\n((?:- .+\n?)+)/,
      );

      const summary = summaryMatch ? summaryMatch[1].trim() : '';
      const ideas = ideasMatch
        ? ideasMatch[1]
            .split('\n')
            .filter((line) => line.startsWith('- '))
            .map((line) => line.replace(/^- /, '').trim())
        : [];

      // Assert
      expect(summary).toBe(
        'This is a markdown formatted summary with proper structure.',
      );
      expect(ideas).toHaveLength(3);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle responses with extra whitespace', () => {
      // Arrange
      const responseWithWhitespace = JSON.stringify({
        summary: '   Summary with leading/trailing spaces   ',
        ideas: [
          '  First idea with spaces  ',
          '\n  Second idea with newlines\n  ',
        ],
        confidence: 'high',
      });

      // Act
      const parsed = JSON.parse(responseWithWhitespace);

      // Validate after trimming
      const trimmedData = {
        summary: parsed.summary.trim(),
        ideas: parsed.ideas.map((idea: string) => idea.trim()),
        confidence: parsed.confidence,
      };

      const validated = validateDigestionResponse(trimmedData);

      // Assert
      expect(validated.summary).toBe('Summary with leading/trailing spaces');
      expect(validated.ideas[0]).toBe('First idea with spaces');
    });

    it('should handle responses with Unicode and special characters', () => {
      // Arrange
      const unicodeResponse = JSON.stringify({
        summary: 'Summary with émojis 🚀 and spéciàl çhàracters',
        ideas: [
          'Idée numéro 1 avec accents',
          'Insight with 日本語 characters',
          'Point with symbols: © ® ™',
        ],
        confidence: 'high',
      });

      // Act
      const parsed = JSON.parse(unicodeResponse);
      const validated = validateDigestionResponse(parsed);

      // Assert
      expect(validated.summary).toContain('🚀');
      expect(validated.ideas[0]).toContain('accents');
      expect(validated.ideas[1]).toContain('日本語');
    });

    it('should handle escaped quotes in JSON', () => {
      // Arrange
      const responseWithQuotes = JSON.stringify({
        summary: 'Summary with "quoted text" inside',
        ideas: ['Idea with "double quotes"', "Idea with 'single quotes'"],
        confidence: 'medium',
      });

      // Act
      const parsed = JSON.parse(responseWithQuotes);
      const validated = validateDigestionResponse(parsed);

      // Assert
      expect(validated.summary).toContain('"quoted text"');
      expect(validated.ideas[0]).toContain('"double quotes"');
    });

    it('should handle truncated JSON responses', () => {
      // Arrange - JSON cut off mid-response
      const truncatedJSON =
        '{"summary":"This is a truncated","ideas":["First idea","Second';

      // Act & Assert
      expect(() => JSON.parse(truncatedJSON)).toThrow(SyntaxError);
    });

    it('should detect and reject empty or whitespace-only content', () => {
      // Arrange
      const emptyResponse = JSON.stringify({
        summary: '   ',
        ideas: ['Valid idea'],
        confidence: 'low',
      });

      // Act & Assert
      const parsed = JSON.parse(emptyResponse);
      expect(() => validateDigestionResponse(parsed)).toThrow();
    });
  });

  describe('Confidence Level Parsing', () => {
    it('should parse all valid confidence levels', () => {
      const levels: Array<'high' | 'medium' | 'low'> = [
        'high',
        'medium',
        'low',
      ];

      levels.forEach((level) => {
        // Arrange
        const response = JSON.stringify({
          summary: `Summary with ${level} confidence`,
          ideas: ['Test idea'],
          confidence: level,
        });

        // Act
        const parsed = JSON.parse(response);
        const validated = validateDigestionResponse(parsed);

        // Assert
        expect(validated.confidence).toBe(level);
      });
    });

    it('should reject invalid confidence levels', () => {
      // Arrange
      const invalidResponse = JSON.stringify({
        summary: 'Summary with invalid confidence',
        ideas: ['Test idea'],
        confidence: 'very-high', // Invalid value
      });

      // Act & Assert
      const parsed = JSON.parse(invalidResponse);
      expect(() => validateDigestionResponse(parsed)).toThrow();
    });

    it('should handle missing confidence with default value', () => {
      // Arrange
      const responseWithoutConfidence = JSON.stringify({
        summary: 'Summary without confidence field',
        ideas: ['Idea one', 'Idea two'],
      });

      // Act
      const parsed = JSON.parse(responseWithoutConfidence);
      const validated = validateDigestionResponse(parsed);

      // Assert
      expect(validated.confidence).toBe('high'); // Default
    });
  });

  describe('Ideas Array Parsing', () => {
    it('should validate minimum idea count (at least 1)', () => {
      // Arrange
      const responseWithNoIdeas = JSON.stringify({
        summary: 'Summary without ideas',
        ideas: [],
      });

      // Act & Assert
      const parsed = JSON.parse(responseWithNoIdeas);
      expect(() => validateDigestionResponse(parsed)).toThrow(
        /at least one idea/i,
      );
    });

    it('should validate maximum idea count (max 10)', () => {
      // Arrange
      const tooManyIdeas = Array.from(
        { length: 11 },
        (_, i) => `Idea number ${i + 1}`,
      );
      const response = JSON.stringify({
        summary: 'Summary with too many ideas',
        ideas: tooManyIdeas,
      });

      // Act & Assert
      const parsed = JSON.parse(response);
      expect(() => validateDigestionResponse(parsed)).toThrow(
        /maximum 10 ideas/i,
      );
    });

    it('should validate each idea length (5-200 characters)', () => {
      // Arrange - Idea too short
      const tooShort = JSON.stringify({
        summary: 'Summary with short idea',
        ideas: ['Hi'], // Only 2 characters
      });

      // Arrange - Idea too long
      const tooLong = JSON.stringify({
        summary: 'Summary with long idea',
        ideas: ['x'.repeat(201)], // 201 characters
      });

      // Act & Assert
      const parsedShort = JSON.parse(tooShort);
      expect(() => validateDigestionResponse(parsedShort)).toThrow(
        /at least 5 characters/i,
      );

      const parsedLong = JSON.parse(tooLong);
      expect(() => validateDigestionResponse(parsedLong)).toThrow(
        /not exceed 200 characters/i,
      );
    });
  });

  describe('Summary Parsing', () => {
    it('should validate summary length (10-500 characters)', () => {
      // Arrange - Summary too short
      const tooShort = JSON.stringify({
        summary: 'Short', // Only 5 characters
        ideas: ['Valid idea'],
      });

      // Arrange - Summary too long
      const tooLong = JSON.stringify({
        summary: 'x'.repeat(501), // 501 characters
        ideas: ['Valid idea'],
      });

      // Act & Assert
      const parsedShort = JSON.parse(tooShort);
      expect(() => validateDigestionResponse(parsedShort)).toThrow(
        /at least 10 characters/i,
      );

      const parsedLong = JSON.parse(tooLong);
      expect(() => validateDigestionResponse(parsedLong)).toThrow(
        /not exceed 500 characters/i,
      );
    });

    it('should reject empty or whitespace-only summaries', () => {
      // Arrange
      const whitespaceOnly = JSON.stringify({
        summary: '     \n\t   ',
        ideas: ['Valid idea'],
      });

      // Act & Assert
      const parsed = JSON.parse(whitespaceOnly);
      expect(() => validateDigestionResponse(parsed)).toThrow(
        /cannot be empty/i,
      );
    });
  });
});
