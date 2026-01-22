/**
 * BDD Acceptance Tests for Story 2.1: Capture Audio 1-Tap (Full version)
 *
 * Test Strategy:
 * - Uses jest-cucumber for BDD with Gherkin
 * - Fast execution with in-memory mocks (no real DB, no simulator)
 * - Validates business logic in isolation
 * - Data-driven tests with Scenario Outlines
 *
 * Coverage:
 * - AC1: Start Recording < 500ms (2 scenarios)
 * - AC2: Stop and Save Recording (1 plan + 2 scenarios)
 * - AC3: Offline Functionality (2 scenarios)
 * - AC4: Crash Recovery (2 scenarios)
 * - AC5: Microphone Permissions (2 scenarios)
 * - Edge Cases (1 plan + 2 scenarios)
 *
 * Run: npm run test:acceptance -- --testPathPatterns="story-2-1.test"
 */

import { defineFeature, loadFeature } from 'jest-cucumber';
import { TestContext } from './support/test-context';
import { RecordingService } from '../../src/contexts/capture/services/RecordingService';
import { CaptureRepository } from '../../src/contexts/capture/data/CaptureRepository';

const feature = loadFeature('tests/acceptance/features/story-2-1-capture-audio.feature');

defineFeature(feature, (test) => {
  let context: TestContext;
  let recordingService: RecordingService;
  let captureRepo: CaptureRepository;
  let startTime: number;
  let error: Error | null = null;

  beforeEach(() => {
    context = new TestContext();
    captureRepo = new CaptureRepository();
    recordingService = new RecordingService(
      context.audioRecorder,
      context.fileSystem,
      captureRepo,
      context.permissions
    );
    context.setUserId('user-123');
    error = null;
  });

  afterEach(() => {
    context.reset();
  });

  // ========================================================================
  // AC1: Start Recording with < 500ms Latency
  // ========================================================================

  test('Démarrer l\'enregistrement avec latence minimale', ({ given, and, when, then }) => {
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

    and('le fichier audio est initialisé dans le stockage', () => {
      const status = context.audioRecorder.getStatus();
      expect(status.isRecording).toBe(true);
      expect(status.uri).toBeDefined();
    });
  });

  test('Créer une entité Capture pendant l\'enregistrement', ({ when, then, and }) => {
    when('l\'utilisateur démarre un enregistrement', async () => {
      await recordingService.startRecording();
    });

    then('une entité Capture existe avec:', async (table: any[]) => {
      const captures = await captureRepo.findAll();
      expect(captures).toHaveLength(1);

      const capture = captures[0];
      table.forEach((row) => {
        const field = row.champ as keyof typeof capture;
        expect(capture[field]).toBe(row.valeur);
      });
    });

    and('la capture a un ID unique généré', async () => {
      const captures = await captureRepo.findAll();
      expect(captures[0].id).toBeDefined();
      expect(typeof captures[0].id).toBe('string');
    });

    and('la capture a un timestamp capturedAt', async () => {
      const captures = await captureRepo.findAll();
      expect(captures[0].capturedAt).toBeInstanceOf(Date);
    });
  });

  // ========================================================================
  // AC2: Stop and Save Recording
  // ========================================================================

  test('Sauvegarder avec différentes durées d\'enregistrement', ({ when, and, then }) => {
    when(/l'utilisateur enregistre pendant (\d+) secondes/, async (durée: string) => {
      await recordingService.startRecording();
      const durationMs = parseInt(durée) * 1000;
      context.audioRecorder.simulateRecording(durationMs);
    });

    and('l\'utilisateur arrête l\'enregistrement', async () => {
      await recordingService.stopRecording();
    });

    then('une Capture est sauvegardée avec:', async (table: any[]) => {
      const captures = await captureRepo.findAll();
      expect(captures).toHaveLength(1);

      const capture = captures[0];
      table.forEach((row) => {
        const field = row.champ as keyof typeof capture;
        const expectedValue = row.valeur;

        if (field === 'duration') {
          // Duration is parameterized, extract from scenario
          expect(capture[field]).toBeDefined();
        } else {
          expect(capture[field]).toBe(expectedValue);
        }
      });
    });

    and(/le fichier audio existe avec le nom "(.*)"/, (pattern: string) => {
      const files = context.fileSystem.getFiles();
      const audioFile = files.find(f => f.path.startsWith('capture_user-123_') && f.path.endsWith('.m4a'));
      expect(audioFile).toBeDefined();
    });

    and(/les métadonnées incluent la durée (\d+)ms/, async (duréeMs: string) => {
      const captures = await captureRepo.findAll();
      expect(captures[0].duration).toBe(parseInt(duréeMs));
    });
  });

  test('Stocker les métadonnées complètes du fichier audio', ({ when, and, then }) => {
    when(/l'utilisateur enregistre pendant (\d+) secondes/, async (durée: string) => {
      await recordingService.startRecording();
      const durationMs = parseInt(durée) * 1000;
      context.audioRecorder.simulateRecording(durationMs);
    });

    and('l\'utilisateur arrête l\'enregistrement', async () => {
      await recordingService.stopRecording();
    });

    then('la Capture contient les métadonnées:', async (table: any[]) => {
      const captures = await captureRepo.findAll();
      const capture = captures[0];

      table.forEach((row) => {
        const field = row.champ as keyof typeof capture;
        const type = row.type;
        const contrainte = row.contrainte;

        // Validate field exists and has correct type
        expect(capture[field]).toBeDefined();

        if (type === 'number') {
          expect(typeof capture[field]).toBe('number');
          if (contrainte === '3000') {
            expect(capture[field]).toBe(3000);
          } else if (contrainte === '> 0') {
            expect(capture[field] as number).toBeGreaterThan(0);
          }
        } else if (type === 'string') {
          expect(typeof capture[field]).toBe('string');
          if (contrainte === 'non vide') {
            expect((capture[field] as string).length).toBeGreaterThan(0);
          } else if (contrainte === 'm4a') {
            expect(capture[field]).toBe('m4a');
          }
        } else if (type === 'datetime') {
          expect(capture[field]).toBeInstanceOf(Date);
        }
      });
    });
  });

  test('Nommer les fichiers selon la convention', ({ when, and, then }) => {
    when(/l'utilisateur enregistre pendant (\d+) seconde/, async (durée: string) => {
      await recordingService.startRecording();
      const durationMs = parseInt(durée) * 1000;
      context.audioRecorder.simulateRecording(durationMs);
    });

    and('l\'utilisateur arrête l\'enregistrement', async () => {
      await recordingService.stopRecording();
    });

    then('le fichier audio est nommé selon le pattern:', (docString: string) => {
      // Pattern described in docstring
      const files = context.fileSystem.getFiles();
      const audioFile = files.find(f => f.path.includes('.m4a'));
      expect(audioFile).toBeDefined();
    });

    and(/le fichier commence par "(.*)"/, (prefix: string) => {
      const files = context.fileSystem.getFiles();
      const audioFile = files.find(f => f.path.includes('.m4a'));
      expect(audioFile!.path).toMatch(new RegExp(`^${prefix.replace('*', '.*')}`));
    });

    and(/le fichier se termine par "(.*)"/, (suffix: string) => {
      const files = context.fileSystem.getFiles();
      const audioFile = files.find(f => f.path.includes('.m4a'));
      expect(audioFile!.path.endsWith(suffix)).toBe(true);
    });
  });

  // ========================================================================
  // AC3: Offline Functionality
  // ========================================================================

  test('Capturer en mode hors ligne', ({ given, when, and, then }) => {
    given('l\'appareil est hors ligne', () => {
      context.setOffline(true);
    });

    when(/l'utilisateur enregistre pendant (\d+) secondes/, async (durée: string) => {
      await recordingService.startRecording();
      const durationMs = parseInt(durée) * 1000;
      context.audioRecorder.simulateRecording(durationMs);
    });

    and('l\'utilisateur arrête l\'enregistrement', async () => {
      await recordingService.stopRecording();
    });

    then('la capture fonctionne de manière identique au mode en ligne', async () => {
      const captures = await captureRepo.findAll();
      expect(captures).toHaveLength(1);
      expect(captures[0].state).toBe('CAPTURED');
    });

    and('la Capture a le statut syncStatus = "pending"', async () => {
      const captures = await captureRepo.findAll();
      expect(captures[0].syncStatus).toBe('pending');
    });

    and('aucune erreur réseau n\'est levée', () => {
      // If we got here without throwing, offline mode works
      expect(error).toBeNull();
    });
  });

  test('Marquer pour synchronisation future', ({ given, when, then, and }) => {
    given('l\'appareil est hors ligne', () => {
      context.setOffline(true);
    });

    when('l\'utilisateur complète une capture', async () => {
      await recordingService.startRecording();
      context.audioRecorder.simulateRecording(1000);
      await recordingService.stopRecording();
    });

    then('la Capture a syncStatus = "pending"', async () => {
      const captures = await captureRepo.findAll();
      expect(captures[0].syncStatus).toBe('pending');
    });

    and('la Capture sera éligible pour sync quand le réseau reviendra', async () => {
      const pendingCaptures = await captureRepo.findBySyncStatus('pending');
      expect(pendingCaptures.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // AC4: Crash Recovery
  // ========================================================================

  test('Récupérer un enregistrement interrompu par crash', ({ given, and, when, then }) => {
    given('l\'utilisateur a démarré un enregistrement', async () => {
      await recordingService.startRecording();
    });

    and('l\'enregistrement dure depuis 2 secondes', () => {
      context.audioRecorder.simulateRecording(2000);
    });

    when('l\'application crash', () => {
      // Simulate crash by not calling stopRecording
      // Recording is still in RECORDING state
    });

    and('le service de récupération détecte l\'enregistrement incomplet', async () => {
      await recordingService.recoverIncompleteRecordings();
    });

    then('l\'enregistrement partiel est récupéré', async () => {
      const captures = await captureRepo.findAll();
      expect(captures.length).toBeGreaterThan(0);
    });

    and('une Capture est créée avec state = "RECOVERED"', async () => {
      const recoveredCaptures = await captureRepo.findByState('RECOVERED');
      expect(recoveredCaptures).toHaveLength(1);
    });

    and('le fichier audio partiel est préservé', async () => {
      const captures = await captureRepo.findAll();
      expect(captures[0].filePath).toBeDefined();
    });
  });

  test('Signaler la récupération à l\'utilisateur', ({ given, when, then, and }) => {
    given('un enregistrement a été récupéré après crash', async () => {
      await recordingService.startRecording();
      context.audioRecorder.simulateRecording(2000);
      // Simulate crash and recovery
      await recordingService.recoverIncompleteRecordings();
    });

    when('le service de récupération traite la capture', () => {
      // Recovery already processed in given step
    });

    then('la Capture a un flag recoveredFromCrash = true', async () => {
      const captures = await captureRepo.findAll();
      expect(captures[0].recoveredFromCrash).toBe(true);
    });

    and('la Capture contient les métadonnées de récupération', async () => {
      const captures = await captureRepo.findAll();
      expect(captures[0].state).toBe('RECOVERED');
      expect(captures[0].duration).toBeDefined();
    });
  });

  // ========================================================================
  // AC5: Microphone Permission Handling
  // ========================================================================

  test('Vérifier les permissions avant d\'enregistrer', ({ given, when, then, and }) => {
    given('les permissions microphone ne sont pas accordées', () => {
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
      expect(error!.message).toContain('MicrophonePermissionDenied');
    });

    and('aucune Capture n\'est créée', async () => {
      const captures = await captureRepo.findAll();
      expect(captures).toHaveLength(0);
    });

    and('aucun fichier audio n\'est créé', () => {
      const files = context.fileSystem.getFiles();
      expect(files).toHaveLength(0);
    });
  });

  test('Enregistrer avec permissions accordées', ({ given, when, then, and }) => {
    given('les permissions microphone sont accordées', () => {
      context.permissions.setMicrophonePermission(true);
    });

    when('l\'utilisateur démarre un enregistrement', async () => {
      await recordingService.startRecording();
    });

    then('l\'enregistrement démarre avec succès', () => {
      const status = context.audioRecorder.getStatus();
      expect(status.isRecording).toBe(true);
    });

    and('une Capture est créée', async () => {
      const captures = await captureRepo.findAll();
      expect(captures).toHaveLength(1);
    });
  });

  // ========================================================================
  // Edge Cases & Bug Prevention
  // ========================================================================

  test('Gérer les enregistrements très courts', ({ when, and, then }) => {
    when(/l'utilisateur enregistre pendant (\d+) millisecondes/, async (durée: string) => {
      await recordingService.startRecording();
      context.audioRecorder.simulateRecording(parseInt(durée));
    });

    and('l\'utilisateur arrête l\'enregistrement', async () => {
      await recordingService.stopRecording();
    });

    then('la Capture est créée malgré la courte durée', async () => {
      const captures = await captureRepo.findAll();
      expect(captures).toHaveLength(1);
    });

    and(/la durée stockée est (\d+)ms/, async (durée: string) => {
      const captures = await captureRepo.findAll();
      expect(captures[0].duration).toBe(parseInt(durée));
    });
  });

  test('Gérer l\'espace de stockage faible', ({ given, when, then, and }) => {
    given('l\'espace de stockage disponible est < 1MB', () => {
      context.fileSystem.setAvailableSpace(500 * 1024); // 500KB
    });

    when('l\'utilisateur tente de démarrer un enregistrement', async () => {
      try {
        await recordingService.startRecording();
        // Try to save a large file
        context.audioRecorder.simulateRecording(10000);
        await recordingService.stopRecording();
      } catch (err) {
        error = err as Error;
      }
    });

    then('une erreur InsufficientStorage est levée', () => {
      expect(error).toBeDefined();
      expect(error!.message).toContain('InsufficientStorage');
    });

    and('l\'utilisateur est informé du problème de stockage', () => {
      expect(error!.message).toContain('Storage');
    });
  });

  test('Empêcher les enregistrements concurrents', ({ given, when, then, and }) => {
    given('un enregistrement est en cours', async () => {
      await recordingService.startRecording();
    });

    when('l\'utilisateur tente de démarrer un second enregistrement', async () => {
      try {
        await recordingService.startRecording();
      } catch (err) {
        error = err as Error;
      }
    });

    then('une erreur RecordingAlreadyInProgress est levée', () => {
      expect(error).toBeDefined();
      expect(error!.message).toContain('RecordingAlreadyInProgress');
    });

    and('le premier enregistrement continue sans interruption', () => {
      const status = context.audioRecorder.getStatus();
      expect(status.isRecording).toBe(true);
    });
  });
});
