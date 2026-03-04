/**
 * Unit Tests — getUrgencyBorderColor()
 *
 * Story 8.15 — Code Review Fix M3
 * Couvre le mapping UrgencyLevel → couleur hex
 */

import { getUrgencyBorderColor, URGENCY_BORDER_COLORS } from '../getUrgencyBorderColor';
import type { UrgencyLevel } from '../getUrgencyLevel';

describe('getUrgencyBorderColor', () => {
  it('retourne rouge (#EF4444) pour "overdue"', () => {
    expect(getUrgencyBorderColor('overdue')).toBe('#EF4444');
  });

  it('retourne orange (#F97316) pour "prioritaire"', () => {
    expect(getUrgencyBorderColor('prioritaire')).toBe('#F97316');
  });

  it('retourne amber (#F59E0B) pour "approaching"', () => {
    expect(getUrgencyBorderColor('approaching')).toBe('#F59E0B');
  });

  it('retourne transparent pour "normal"', () => {
    expect(getUrgencyBorderColor('normal')).toBe('transparent');
  });

  it('cohérence : getUrgencyBorderColor(level) === URGENCY_BORDER_COLORS[level]', () => {
    const levels: UrgencyLevel[] = ['overdue', 'prioritaire', 'approaching', 'normal'];
    levels.forEach((level) => {
      expect(getUrgencyBorderColor(level)).toBe(URGENCY_BORDER_COLORS[level]);
    });
  });

  it('couvre toutes les UrgencyLevels sans retourner de valeur vide', () => {
    const levels: UrgencyLevel[] = ['overdue', 'prioritaire', 'approaching', 'normal'];
    levels.forEach((level) => {
      const color = getUrgencyBorderColor(level);
      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
    });
  });
});
