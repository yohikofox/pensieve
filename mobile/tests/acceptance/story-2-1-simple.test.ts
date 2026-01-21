/**
 * BDD Acceptance Tests for Story 2.1 - Simplified Version
 *
 * Run: npm run test:acceptance
 */

import { defineFeature, loadFeature } from 'jest-cucumber';
import { TestContext } from './support/test-context';
import { RecordingService } from '../../src/services/RecordingService';
import { CaptureRepository } from '../../src/repositories/CaptureRepository';

const feature = loadFeature('tests/acceptance/features/story-2-1-capture-audio-simple.feature');

defineFeature(feature, (test) => {
  let context: TestContext;
  let recordingService: RecordingService;
  let captureRepo: CaptureRepository;
  let startTime: number;

  beforeEach(() => {
    context = new TestContext();
    captureRepo = new CaptureRepository(context.db);
    recordingService = new RecordingService(
      context.audioRecorder,
      context.fileSystem,
      captureRepo,
      context.permissions
    );
  });

  afterEach(() => {
    context.reset();
  });

  // ========================================================================
  // AC1: Start Recording with < 500ms Latency
  // ========================================================================

  test('Démarrer l\'enregistrement avec latence minimale', ({ given, when, then, and }) => {
    given(/l'utilisateur "(.*)" est authentifié/, (userId: string) => {
      context.setUserId(userId);
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
      const captures = await captureRepo.findByState('RECORDING');
      expect(captures).toHaveLength(1);
      expect(captures[0].state).toBe('RECORDING');
    });
  });

  // ========================================================================
  // AC2: Stop and Save Recording
  // ========================================================================

  test('Sauvegarder un enregistrement de 2 secondes', ({ given, when, then, and }) => {
    given(/l'utilisateur "(.*)" est authentifié/, (userId: string) => {
      context.setUserId(userId);
    });

    and('le service d\'enregistrement est initialisé', () => {
      expect(recordingService).toBeDefined();
    });

    when(/l'utilisateur enregistre pendant (\d+) secondes/, async (durée: string) => {
      await recordingService.startRecording();
      const durationMs = parseInt(durée) * 1000;
      context.audioRecorder.simulateRecording(durationMs);
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
  // AC5: Microphone Permission Handling
  // ========================================================================

  test('Vérifier les permissions avant d\'enregistrer', ({ given, when, then, and }) => {
    let error: Error | null = null;

    given(/l'utilisateur "(.*)" est authentifié/, (userId: string) => {
      context.setUserId(userId);
    });

    and('le service d\'enregistrement est initialisé', () => {
      expect(recordingService).toBeDefined();
    });

    and('les permissions microphone ne sont pas accordées', () => {
      context.permissions.setMicrophonePermission(false);
    });

    when('l\'utilisateur tente de démarrer un enregistrement', async () => {
      try {
        await recordingService.startRecording();
      } catch (err) {
        error = err as Error;
      }
    });

    then('une erreur MicrophonePermissionDenied est levée', () => {
      expect(error).toBeDefined();
      expect(error?.message).toContain('MicrophonePermissionDenied');
    });
  });
});
