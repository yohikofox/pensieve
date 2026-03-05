/**
 * Tests unitaires pour le helper isProcessing
 * Story 16.1 — Task 5.1
 */

import { isProcessing } from '../capture.guards';

describe('isProcessing', () => {
  it('retourne true quand state === "processing"', () => {
    expect(isProcessing({ state: 'processing' })).toBe(true);
  });

  it('retourne true quand isInQueue est true', () => {
    expect(isProcessing({ state: 'captured', isInQueue: true })).toBe(true);
  });

  it('retourne true quand state === "processing" ET isInQueue est true', () => {
    expect(isProcessing({ state: 'processing', isInQueue: true })).toBe(true);
  });

  it('retourne false quand state === "captured" sans queue', () => {
    expect(isProcessing({ state: 'captured' })).toBe(false);
  });

  it('retourne false quand state === "ready"', () => {
    expect(isProcessing({ state: 'ready' })).toBe(false);
  });

  it('retourne false quand state === "failed"', () => {
    expect(isProcessing({ state: 'failed' })).toBe(false);
  });

  it('retourne false quand isInQueue est false', () => {
    expect(isProcessing({ state: 'captured', isInQueue: false })).toBe(false);
  });

  it('retourne false quand isInQueue est undefined', () => {
    expect(isProcessing({ state: 'ready', isInQueue: undefined })).toBe(false);
  });
});
