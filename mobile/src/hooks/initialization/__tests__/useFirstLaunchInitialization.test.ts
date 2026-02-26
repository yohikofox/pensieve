/**
 * Tests for useFirstLaunchInitialization hook
 *
 * Story 24.4 — Fix H1: couverture du hook non testé
 *
 * Cas couverts :
 * 1. userId null → run() non déclenché
 * 2. userId fourni → run() appelé une seule fois
 * 3. userId fourni deux fois (re-render) → run() appelé une seule fois (hasRunRef)
 * 4. skip() → isVisible passe à false
 * 5. Callback progress → isVisible=true + progress mis à jour
 * 6. run() qui lève une exception → setIsVisible(false) appelé (pas de crash)
 */

import 'reflect-metadata';
import { renderHook, act } from '@testing-library/react-native';
import { useFirstLaunchInitialization } from '../useFirstLaunchInitialization';
import { TOKENS } from '../../../infrastructure/di/tokens';

// ── Mock tsyringe container ───────────────────────────────────────────────────

const mockRun = jest.fn();

jest.mock('tsyringe', () => ({
  container: {
    resolve: jest.fn(() => ({ run: mockRun })),
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useFirstLaunchInitialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRun.mockResolvedValue(undefined);
  });

  // ── Cas 1 : userId null → run non déclenché ──────────────────────────────

  it('userId null → run() non déclenché', () => {
    const { result } = renderHook(() => useFirstLaunchInitialization(null));

    expect(mockRun).not.toHaveBeenCalled();
    expect(result.current.isVisible).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  // ── Cas 2 : userId fourni → run() appelé ─────────────────────────────────

  it('userId fourni → run() appelé avec un callback onProgress', async () => {
    const { result } = renderHook(() => useFirstLaunchInitialization('user-123'));

    // Attendre la résolution de la Promise
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith(expect.any(Function));
    // Après complétion, overlay caché
    expect(result.current.isVisible).toBe(false);
  });

  // ── Cas 3 : re-render avec même userId → run() appelé une seule fois ─────

  it('re-render avec même userId → run() appelé une seule fois (hasRunRef guard)', async () => {
    let userId = 'user-123';
    const { result, rerender } = renderHook(() => useFirstLaunchInitialization(userId));

    await act(async () => {
      await Promise.resolve();
    });

    rerender({});

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  // ── Cas 4 : skip() cache l'overlay ───────────────────────────────────────

  it('skip() passe isVisible à false', async () => {
    // run() ne résout pas immédiatement pour pouvoir tester l'état intermédiaire
    let resolveRun!: () => void;
    mockRun.mockImplementation((onProgress: (p: number) => void) => {
      // Déclencher le callback progress pour rendre l'overlay visible
      onProgress(0);
      return new Promise<void>((resolve) => { resolveRun = resolve; });
    });

    const { result } = renderHook(() => useFirstLaunchInitialization('user-456'));

    // Attendre que onProgress(0) soit appelé → overlay visible
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isVisible).toBe(true);

    // L'utilisateur clique skip
    act(() => {
      result.current.skip();
    });

    expect(result.current.isVisible).toBe(false);

    // Laisser run() se terminer proprement
    await act(async () => {
      resolveRun();
      await Promise.resolve();
    });
  });

  // ── Cas 5 : progress callback → overlay + valeur progress ────────────────

  it('callback progress → isVisible=true et progress mis à jour', async () => {
    let capturedCallback!: (p: number) => void;
    mockRun.mockImplementation((onProgress: (p: number) => void) => {
      capturedCallback = onProgress;
      return Promise.resolve();
    });

    const { result } = renderHook(() => useFirstLaunchInitialization('user-789'));

    await act(async () => {
      await Promise.resolve();
    });

    // Simuler des événements progress
    act(() => {
      capturedCallback(0);
    });
    expect(result.current.isVisible).toBe(true);
    expect(result.current.progress).toBe(0);

    act(() => {
      capturedCallback(0.6);
    });
    expect(result.current.progress).toBe(0.6);
  });

  // ── Cas 6 : run() lève une exception → pas de crash ──────────────────────

  it('run() qui rejette → setIsVisible(false), pas de crash', async () => {
    mockRun.mockRejectedValue(new Error('Unexpected error'));

    const { result } = renderHook(() => useFirstLaunchInitialization('user-err'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isVisible).toBe(false);
  });
});
