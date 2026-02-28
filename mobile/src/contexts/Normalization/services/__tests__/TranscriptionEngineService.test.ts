/**
 * TranscriptionEngineService Unit Tests
 * Story 8.4: Transcription Native par Défaut
 *
 * Cas couverts (5) :
 * 1. Préférence explicite 'native' → retourne 'native' (AC4)
 * 2. Préférence explicite 'whisper' → retourne 'whisper' (AC4)
 * 3. Aucune préférence, FIRST_LAUNCH_KEY = 'true', migration non faite → migration whisper (AC2)
 * 4. Aucune préférence, FIRST_LAUNCH_KEY = null, migration non faite → natif (nouvel utilisateur) (AC1)
 * 5. Aucune préférence, migration déjà faite → retourne 'native' (AC1)
 */

import 'reflect-metadata';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TranscriptionEngineService } from '../TranscriptionEngineService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

const STORAGE_KEY = '@pensieve/transcription_engine';
const FIRST_LAUNCH_KEY = '@pensieve/first_launch_completed';
const MIGRATION_KEY = '@pensieve/transcription_default_migrated';

function makeNativeEngineMock() {
  return { isAvailable: jest.fn().mockResolvedValue(true) };
}

describe('TranscriptionEngineService.getSelectedEngineType()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  // ── Cas 1 : Préférence explicite 'native' ─────────────────────────────────

  it("préférence explicite 'native' → retourne 'native' sans migration (AC4)", async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === STORAGE_KEY) return Promise.resolve('native');
      return Promise.resolve(null);
    });

    const service = new TranscriptionEngineService(makeNativeEngineMock() as never);
    const result = await service.getSelectedEngineType();

    expect(result).toBe('native');
    // Aucun setItem ne doit être appelé — préférence explicite inchangée
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  // ── Cas 2 : Préférence explicite 'whisper' ────────────────────────────────

  it("préférence explicite 'whisper' → retourne 'whisper' sans migration (AC4)", async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === STORAGE_KEY) return Promise.resolve('whisper');
      return Promise.resolve(null);
    });

    const service = new TranscriptionEngineService(makeNativeEngineMock() as never);
    const result = await service.getSelectedEngineType();

    expect(result).toBe('whisper');
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  // ── Cas 3 : Migration utilisateur existant (FIRST_LAUNCH_KEY = 'true', pas de migration) ─

  it("utilisateur existant sans préférence → migration one-time vers 'whisper' (AC2)", async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === STORAGE_KEY) return Promise.resolve(null);
      if (key === MIGRATION_KEY) return Promise.resolve(null); // migration pas encore faite
      if (key === FIRST_LAUNCH_KEY) return Promise.resolve('true'); // utilisateur existant
      return Promise.resolve(null);
    });

    const service = new TranscriptionEngineService(makeNativeEngineMock() as never);
    const result = await service.getSelectedEngineType();

    expect(result).toBe('whisper');
    // Migration : persiste 'whisper' ET marque la migration done
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'whisper');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(MIGRATION_KEY, 'done');
  });

  // ── Cas 4 : Nouvel utilisateur (pas de first_launch, pas de migration) ────

  it("nouvel utilisateur sans préférence → retourne 'native' (AC1)", async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === STORAGE_KEY) return Promise.resolve(null);
      if (key === MIGRATION_KEY) return Promise.resolve(null); // migration pas encore faite
      if (key === FIRST_LAUNCH_KEY) return Promise.resolve(null); // nouvel utilisateur
      return Promise.resolve(null);
    });

    const service = new TranscriptionEngineService(makeNativeEngineMock() as never);
    const result = await service.getSelectedEngineType();

    expect(result).toBe('native');
    // Marque la migration done (FirstLaunchInitializer gère le reste)
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(MIGRATION_KEY, 'done');
    // Ne doit PAS persister STORAGE_KEY (FirstLaunchInitializer le fait)
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(STORAGE_KEY, expect.anything());
  });

  // ── Cas 5 : Migration déjà faite, pas de préférence → natif par défaut ───

  it("migration déjà faite + aucune préférence → retourne 'native' (AC1)", async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === STORAGE_KEY) return Promise.resolve(null);
      if (key === MIGRATION_KEY) return Promise.resolve('done'); // migration déjà faite
      return Promise.resolve(null);
    });

    const service = new TranscriptionEngineService(makeNativeEngineMock() as never);
    const result = await service.getSelectedEngineType();

    expect(result).toBe('native');
    // Aucune migration supplémentaire
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  // ── Cas 6 : Erreur AsyncStorage → fallback 'native' sans propagation ──────

  it("erreur AsyncStorage.getItem → retourne 'native' en fallback sans throw", async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('AsyncStorage unavailable'));

    const service = new TranscriptionEngineService(makeNativeEngineMock() as never);
    const result = await service.getSelectedEngineType();

    // Ne doit pas propager l'erreur, fallback gracieux
    expect(result).toBe('native');
  });

  // ── Cas 7 : AC2 robustesse — utilisateur existant + échec setItem ────────

  it("utilisateur existant + échec setItem → retourne quand même 'whisper' (AC2 robustesse)", async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === STORAGE_KEY) return Promise.resolve(null);
      if (key === MIGRATION_KEY) return Promise.resolve(null);
      if (key === FIRST_LAUNCH_KEY) return Promise.resolve('true');
      return Promise.resolve(null);
    });
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage full'));

    const service = new TranscriptionEngineService(makeNativeEngineMock() as never);
    const result = await service.getSelectedEngineType();

    // AC2 : l'utilisateur existant doit toujours recevoir 'whisper',
    // même si la persistence de migration échoue
    expect(result).toBe('whisper');
  });
});
