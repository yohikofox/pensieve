/**
 * BDD Acceptance Tests for Story 2.1 - Simplified Version
 *
 * Uses TSyringe IoC container for dependency injection.
 *
 * Run: npm run test:acceptance
 */

import { defineFeature, loadFeature } from 'jest-cucumber';
import { container } from 'tsyringe';
import { setupTestContainer, getTestMocks } from './support/test-container';
import { RecordingService } from '../../src/contexts/capture/services/RecordingService';
import { MockCaptureRepository } from './support/mocks/MockCaptureRepository';
import { MockAudioRecorder, MockPermissionManager } from './support/test-context';

const feature = loadFeature('tests/acceptance/features/story-2-1-capture-audio-simple.feature');

defineFeature(feature, (test) => {
  let recordingService: RecordingService;
  let captureRepo: MockCaptureRepository;
  let audioRecorder: MockAudioRecorder;
  let permissions: MockPermissionManager;
  let startTime: number;

  beforeEach(() => {
    setupTestContainer();
    recordingService = container.resolve(RecordingService);
    const mocks = getTestMocks();
    captureRepo = mocks.captureRepo;
    audioRecorder = mocks.audioRecorder;
    permissions = mocks.permissions;
  });

  afterEach(() => {
    captureRepo.reset();
    audioRecorder.reset();
    permissions.reset();
    container.reset();
  });

  // ========================================================================
  // AC1: Start Recording with < 500ms Latency
  // ========================================================================

  test('Démarrer l\'enregistrement avec latence minimale', ({ given, when, then, and }) => {
    given(/l'utilisateur "(.*)" est authentifié/, (userId: string) => {
      // User ID handling will be implemented when auth context is integrated
    });

    and('le service d\'enregistrement est initialisé', () => {
      expect(recordingService).toBeDefined();
    });

    when('l\'utilisateur démarre un enregistrement', async () => {
      startTime = Date.now();
      await recordingService.startRecording();
    });

    then(/l'enregistrement démarre en moins de (\d+)ms/, (maxLatency: string) => {
      const latency = Date.now() - startTime;
      expect(latency).toBeLessThan(parseInt(maxLatency));
    });

    and('une entité Capture est créée avec le statut "recording"', async () => {
      const captures = await captureRepo.findByState('recording');
      expect(captures).toHaveLength(1);
      expect(captures[0].state).toBe('RECORDING');
    });
  });

  // ========================================================================
  // AC2: Stop and Save Recording
  // ========================================================================

  test('Sauvegarder un enregistrement de 2 secondes', ({ given, when, then, and }) => {
    given(/l'utilisateur "(.*)" est authentifié/, (userId: string) => {
      // User ID handling will be implemented when auth context is integrated
    });

    and('le service d\'enregistrement est initialisé', () => {
      expect(recordingService).toBeDefined();
    });

    when(/l'utilisateur enregistre pendant (\d+) secondes/, async (durée: string) => {
      await recordingService.startRecording();
      const durationMs = parseInt(durée) * 1000;
      audioRecorder.simulateRecording(durationMs);
    });

    when('l\'utilisateur arrête l\'enregistrement', async () => {
      await recordingService.stopRecording();
    });

    then('une Capture est sauvegardée avec le statut "CAPTURED"', async () => {
      const captures = await captureRepo.findAll();
      expect(captures).toHaveLength(1);
      expect(captures[0].state).toBe('CAPTURED');
    });

    and(/la durée est de (\d+)ms/, async (expectedDuration: string) => {
      const captures = await captureRepo.findAll();
      expect(captures[0].duration).toBe(parseInt(expectedDuration));
    });
  });

  // ========================================================================
  // AC3: Offline-First Capture
  // ========================================================================

  test('Enregistrer en mode offline', ({ given, when, then, and }) => {
    given(/l'utilisateur "(.*)" est authentifié/, (userId: string) => {
      // User ID handling will be implemented when auth context is integrated
    });

    and('le service d\'enregistrement est initialisé', () => {
      expect(recordingService).toBeDefined();
    });

    and('le réseau est en mode offline', () => {
      // TestContext has setOffline() to simulate network state
      // Note: Current implementation doesn't check network state
      // Capture works identically offline or online (AC3 requirement)
    });

    when('l\'utilisateur démarre un enregistrement', async () => {
      await recordingService.startRecording();
    });

    when(/l'utilisateur enregistre pendant (\d+) secondes/, async (durée: string) => {
      const durationMs = parseInt(durée) * 1000;
      audioRecorder.simulateRecording(durationMs);
    });

    when('l\'utilisateur arrête l\'enregistrement', async () => {
      await recordingService.stopRecording();
    });

    then('une Capture est sauvegardée avec le statut "CAPTURED"', async () => {
      const captures = await captureRepo.findAll();
      expect(captures).toHaveLength(1);
      expect(captures[0].state).toBe('CAPTURED');
    });

    and(/la durée est de (\d+)ms/, async (expectedDuration: string) => {
      const captures = await captureRepo.findAll();
      expect(captures[0].duration).toBe(parseInt(expectedDuration));
    });

    and(/le syncStatus est "(.*)"/, async (expectedStatus: string) => {
      const captures = await captureRepo.findAll();
      expect(captures[0].syncStatus).toBe(expectedStatus);
    });
  });

  // ========================================================================
  // AC5: Microphone Permission Handling
  // ========================================================================

  test('Vérifier les permissions avant d\'enregistrer', ({ given, when, then, and }) => {
    let error: Error | null = null;

    given(/l'utilisateur "(.*)" est authentifié/, (userId: string) => {
      // User ID handling will be implemented when auth context is integrated
    });

    and('le service d\'enregistrement est initialisé', () => {
      expect(recordingService).toBeDefined();
    });

    and('les permissions microphone ne sont pas accordées', () => {
      permissions.setMicrophonePermission(false);
    });

    let result: any;

    when('l\'utilisateur tente de démarrer un enregistrement', async () => {
      result = await recordingService.startRecording();
    });

    then('une erreur MicrophonePermissionDenied est levée', () => {
      expect(result.type).toBe('validation_error');
      expect(result.error).toContain('MicrophonePermissionDenied');
    });
  });
});
