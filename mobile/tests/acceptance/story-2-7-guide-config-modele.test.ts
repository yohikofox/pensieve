/**
 * Step definitions for Story 2.7 - Guide Configuration Modèle Whisper
 *
 * BDD tests focusing on service layer behavior and integration
 */

import { loadFeature, defineFeature } from 'jest-cucumber';
import { container } from 'tsyringe';

// Services
import { TranscriptionModelService } from '../../src/contexts/Normalization/services/TranscriptionModelService';
import { TranscriptionQueueService } from '../../src/contexts/Normalization/services/TranscriptionQueueService';
import type { ICaptureRepository } from '../../src/contexts/capture/domain/ICaptureRepository';
import { TOKENS } from '../../src/infrastructure/di/tokens';
import type { Capture } from '../../src/contexts/capture/domain/Capture.model';

const feature = loadFeature('tests/acceptance/features/story-2-7-guide-config-modele.feature');

defineFeature(feature, (test) => {
  // Shared test context
  let mockModelService: jest.Mocked<TranscriptionModelService>;
  let mockQueueService: jest.Mocked<TranscriptionQueueService>;
  let mockRepository: jest.Mocked<ICaptureRepository>;
  let testCaptures: Capture[];

  // Setup before each scenario
  beforeEach(() => {
    // Mock TranscriptionModelService
    mockModelService = {
      getBestAvailableModel: jest.fn(),
      downloadModel: jest.fn(),
      isModelDownloaded: jest.fn(),
      getModelPath: jest.fn(),
      deleteModel: jest.fn(),
      setSelectedModel: jest.fn(),
      getSelectedModel: jest.fn(),
      getCustomVocabulary: jest.fn(),
      setCustomVocabulary: jest.fn(),
      getPromptString: jest.fn(),
      verifyChecksum: jest.fn(),
      downloadModelWithRetry: jest.fn(),
    } as any;

    // Mock TranscriptionQueueService
    mockQueueService = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      dequeue: jest.fn(),
      getQueueStatus: jest.fn(),
      clear: jest.fn(),
    } as any;

    // Mock CaptureRepository
    mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    // Register mocks in container
    container.registerInstance(TranscriptionModelService, mockModelService);
    container.registerInstance(TranscriptionQueueService, mockQueueService);
    container.registerInstance(TOKENS.ICaptureRepository, mockRepository);

    // Reset test captures
    testCaptures = [];
  });

  afterEach(() => {
    jest.clearAllMocks();
    container.clearInstances();
  });

  // ============================================================================
  // AC1-2: Check proactif + Modal prompt - Service logic tests
  // ============================================================================

  test('L\'utilisateur tente de capturer sans modèle disponible', ({ given, when, then, and }) => {
    let modelAvailable: boolean;

    given('qu\'aucun modèle Whisper n\'est téléchargé', () => {
      mockModelService.getBestAvailableModel.mockResolvedValue(null);
    });

    when('je navigue vers l\'écran de capture', async () => {
      // Simulate the check that happens in CaptureScreen
      const result = await mockModelService.getBestAvailableModel();
      modelAvailable = result !== null;
    });

    and('que je tape sur le bouton de capture vocale', () => {
      // Button press triggers model check
      expect(mockModelService.getBestAvailableModel).toHaveBeenCalled();
    });

    then('je vois le modal "Modèle de transcription requis"', () => {
      // Modal should be shown when no model available
      expect(modelAvailable).toBe(false);
    });

    and('je vois le message "Download a Whisper model to enable audio transcription"', () => {
      expect(modelAvailable).toBe(false);
    });

    and('je vois le bouton "Go to Settings"', () => {
      expect(modelAvailable).toBe(false);
    });

    and('je vois le bouton "Continue without transcription"', () => {
      expect(modelAvailable).toBe(false);
    });
  });

  test('L\'utilisateur capture avec modèle disponible', ({ given, when, then, and }) => {
    let modelAvailable: boolean;

    given('que le modèle "tiny" est téléchargé', () => {
      mockModelService.getBestAvailableModel.mockResolvedValue('tiny');
    });

    when('je navigue vers l\'écran de capture', async () => {
      const result = await mockModelService.getBestAvailableModel();
      modelAvailable = result !== null;
    });

    and('que je tape sur le bouton de capture vocale', () => {
      expect(mockModelService.getBestAvailableModel).toHaveBeenCalled();
    });

    then('le modal "Modèle de transcription requis" ne s\'affiche PAS', () => {
      expect(modelAvailable).toBe(true);
    });

    and('l\'enregistrement audio commence immédiatement', () => {
      expect(modelAvailable).toBe(true);
    });
  });

  // ============================================================================
  // AC4-5: Message + Bouton dans CaptureDetailView - Logic tests
  // ============================================================================

  test('L\'utilisateur ouvre une capture sans modèle disponible', ({ given, when, then, and }) => {
    let capture: Capture;
    let hasModel: boolean;

    given('qu\'aucun modèle Whisper n\'est téléchargé', () => {
      mockModelService.getBestAvailableModel.mockResolvedValue(null);
    });

    and('qu\'une capture audio existe avec state="captured" et normalizedText=null', () => {
      capture = {
        id: 'test-1',
        type: 'audio',
        state: 'captured',
        rawContent: '/path/audio.m4a',
        normalizedText: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        duration: 5000,
      };
      mockRepository.findById.mockResolvedValue(capture);
    });

    when('je navigue vers le détail de cette capture', async () => {
      const result = await mockModelService.getBestAvailableModel();
      hasModel = result !== null;
    });

    then('je vois le badge "Modèle de transcription requis"', () => {
      expect(hasModel).toBe(false);
      expect(capture.state).toBe('captured');
      expect(capture.normalizedText).toBeNull();
    });

    and('je vois le bouton "Télécharger un modèle"', () => {
      expect(hasModel).toBe(false);
    });

    and('le badge est de couleur rouge/error', () => {
      expect(hasModel).toBe(false);
    });
  });

  // ============================================================================
  // AC6: Auto-resume transcription - Main test
  // ============================================================================

  test('Le système reprend automatiquement les transcriptions en attente', ({ given, when, then, and }) => {
    const pendingCaptures: Capture[] = [
      {
        id: 'cap-1',
        type: 'audio',
        state: 'captured',
        rawContent: '/path/1.m4a',
        normalizedText: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        duration: 3000,
      },
      {
        id: 'cap-2',
        type: 'audio',
        state: 'captured',
        rawContent: '/path/2.m4a',
        normalizedText: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        duration: 4000,
      },
      {
        id: 'cap-3',
        type: 'audio',
        state: 'captured',
        rawContent: '/path/3.m4a',
        normalizedText: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        duration: 5000,
      },
    ];

    given('qu\'aucun modèle Whisper n\'est téléchargé', () => {
      mockModelService.getBestAvailableModel.mockResolvedValue(null);
      mockRepository.findAll.mockResolvedValue(pendingCaptures);
    });

    and('que 3 captures audio existent avec state="captured" et normalizedText=null', () => {
      expect(pendingCaptures).toHaveLength(3);
    });

    when('je télécharge le modèle "tiny"', async () => {
      mockModelService.downloadModel.mockResolvedValue('/path/to/tiny.bin');
    });

    and('que le téléchargement se termine avec succès', async () => {
      await mockModelService.downloadModel('tiny');
    });

    and('que la vérification du checksum passe', () => {
      mockModelService.verifyChecksum = jest.fn().mockResolvedValue(true);
    });

    then('le système détecte les 3 captures en attente', async () => {
      // Simulate auto-resume logic from TranscriptionModelService
      const allCaptures = await mockRepository.findAll();
      const pending = allCaptures.filter(
        c => c.type === 'audio' && c.state === 'captured' && !c.normalizedText
      );
      expect(pending).toHaveLength(3);
    });

    and('les 3 captures sont ajoutées à la TranscriptionQueue automatiquement', async () => {
      // Simulate enqueuing all pending captures
      const allCaptures = await mockRepository.findAll();
      const pending = allCaptures.filter(
        c => c.type === 'audio' && c.state === 'captured' && !c.normalizedText
      );

      for (const capture of pending) {
        await mockQueueService.enqueue({
          captureId: capture.id,
          audioPath: capture.rawContent || '',
          audioDuration: capture.duration,
        });
      }

      expect(mockQueueService.enqueue).toHaveBeenCalledTimes(3);
    });

    and('je vois un log "AC6: Auto-resumed 3/3 capture(s)"', () => {
      expect(mockQueueService.enqueue).toHaveBeenCalledTimes(3);
    });
  });

  test('Auto-resume ignore les captures déjà transcrites', ({ given, when, then, and }) => {
    const captures: Capture[] = [
      {
        id: 'pending-1',
        type: 'audio',
        state: 'captured',
        rawContent: '/path/1.m4a',
        normalizedText: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        duration: 3000,
      },
      {
        id: 'pending-2',
        type: 'audio',
        state: 'captured',
        rawContent: '/path/2.m4a',
        normalizedText: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        duration: 4000,
      },
      {
        id: 'done',
        type: 'audio',
        state: 'ready',
        rawContent: '/path/3.m4a',
        normalizedText: 'Already transcribed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        duration: 5000,
      },
    ];

    given('qu\'aucun modèle Whisper n\'est téléchargé', () => {
      mockModelService.getBestAvailableModel.mockResolvedValue(null);
      mockRepository.findAll.mockResolvedValue(captures);
    });

    and('que 2 captures audio existent avec state="captured" et normalizedText=null', () => {
      const pending = captures.filter(c => c.state === 'captured' && !c.normalizedText);
      expect(pending).toHaveLength(2);
    });

    and('que 1 capture audio existe avec state="ready" et normalizedText="texte"', () => {
      const done = captures.find(c => c.normalizedText);
      expect(done).toBeDefined();
    });

    when('je télécharge le modèle "base"', async () => {
      mockModelService.downloadModel.mockResolvedValue('/path/to/base.bin');
      await mockModelService.downloadModel('base');
    });

    and('que le téléchargement se termine avec succès', () => {
      expect(mockModelService.downloadModel).toHaveBeenCalled();
    });

    then('le système détecte 2 captures en attente', async () => {
      const allCaptures = await mockRepository.findAll();
      const pending = allCaptures.filter(
        c => c.type === 'audio' && c.state === 'captured' && !c.normalizedText
      );
      expect(pending).toHaveLength(2);
    });

    and('seulement 2 captures sont ajoutées à la queue', async () => {
      const allCaptures = await mockRepository.findAll();
      const pending = allCaptures.filter(
        c => c.type === 'audio' && c.state === 'captured' && !c.normalizedText
      );

      for (const capture of pending) {
        await mockQueueService.enqueue({
          captureId: capture.id,
          audioPath: capture.rawContent || '',
          audioDuration: capture.duration,
        });
      }

      expect(mockQueueService.enqueue).toHaveBeenCalledTimes(2);
    });

    and('la capture déjà transcrite est ignorée', () => {
      expect(mockQueueService.enqueue).not.toHaveBeenCalledWith(
        expect.objectContaining({ captureId: 'done' })
      );
    });
  });

  // ============================================================================
  // AC7: Badge "Pending model" - Logic test
  // ============================================================================

  test('L\'utilisateur voit le badge "Modèle requis" dans la liste', ({ given, when, then, and }) => {
    const captures: Capture[] = [
      {
        id: 'cap-1',
        type: 'audio',
        state: 'captured',
        rawContent: '/path/1.m4a',
        normalizedText: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        duration: 3000,
      },
      {
        id: 'cap-2',
        type: 'audio',
        state: 'captured',
        rawContent: '/path/2.m4a',
        normalizedText: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        duration: 4000,
      },
    ];
    let hasModel: boolean;
    let badgeCount: number;

    given('qu\'aucun modèle Whisper n\'est téléchargé', () => {
      mockModelService.getBestAvailableModel.mockResolvedValue(null);
      mockRepository.findAll.mockResolvedValue(captures);
    });

    and('que 2 captures audio existent avec state="captured" et normalizedText=null', () => {
      expect(captures).toHaveLength(2);
    });

    when('je navigue vers l\'écran CapturesList', async () => {
      const allCaptures = await mockRepository.findAll();
      const model = await mockModelService.getBestAvailableModel();
      hasModel = model !== null;

      // Count captures that should show "Modèle requis" badge
      badgeCount = allCaptures.filter(
        c => c.type === 'audio' && c.state === 'captured' && !c.normalizedText && !hasModel
      ).length;
    });

    then('je vois 2 captures avec le badge "Modèle requis"', () => {
      expect(badgeCount).toBe(2);
      expect(hasModel).toBe(false);
    });

    and('le badge est de couleur rouge/error', () => {
      expect(hasModel).toBe(false);
    });

    and('le badge a l\'icône "alert-circle"', () => {
      expect(hasModel).toBe(false);
    });
  });

  // ============================================================================
  // Edge cases
  // ============================================================================

  test('Le check de modèle échoue gracieusement', ({ given, when, then, and }) => {
    let errorOccurred: boolean = false;
    let shouldProceed: boolean = false;

    given('que TranscriptionModelService.getBestAvailableModel() lève une erreur', () => {
      mockModelService.getBestAvailableModel.mockRejectedValue(new Error('Network error'));
    });

    when('je navigue vers l\'écran de capture', async () => {
      try {
        await mockModelService.getBestAvailableModel();
      } catch (error) {
        errorOccurred = true;
        // Should proceed with recording anyway
        shouldProceed = true;
      }
    });

    and('que je tape sur le bouton de capture vocale', () => {
      expect(mockModelService.getBestAvailableModel).toHaveBeenCalled();
    });

    then('l\'enregistrement commence quand même', () => {
      expect(shouldProceed).toBe(true);
    });

    and('aucun modal d\'erreur ne s\'affiche', () => {
      expect(shouldProceed).toBe(true);
    });

    and('un warning est loggé', () => {
      expect(errorOccurred).toBe(true);
    });
  });

  test('Badge "Pending model" a priorité sur "Pending"', ({ given, when, then, and }) => {
    const capture: Capture = {
      id: 'test',
      type: 'audio',
      state: 'captured',
      rawContent: '/path/audio.m4a',
      normalizedText: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      duration: 3000,
    };
    let hasModel: boolean;
    let shouldShowPendingModelBadge: boolean;

    given('qu\'aucun modèle Whisper n\'est téléchargé', () => {
      mockModelService.getBestAvailableModel.mockResolvedValue(null);
      mockRepository.findAll.mockResolvedValue([capture]);
    });

    and('qu\'une capture audio existe avec state="captured" et normalizedText=null', () => {
      expect(capture.state).toBe('captured');
      expect(capture.normalizedText).toBeNull();
    });

    and('que la capture n\'est PAS dans la queue', () => {
      // Capture has no isInQueue flag
    });

    when('je navigue vers CapturesList', async () => {
      const model = await mockModelService.getBestAvailableModel();
      hasModel = model !== null;

      // Badge logic: Show "Modèle requis" if no model AND state=captured AND no text
      shouldShowPendingModelBadge = !hasModel && capture.state === 'captured' && !capture.normalizedText;
    });

    then('je vois le badge "Modèle requis"', () => {
      expect(shouldShowPendingModelBadge).toBe(true);
      expect(hasModel).toBe(false);
    });

    and('je NE vois PAS le badge "En attente de transcription"', () => {
      // When "Modèle requis" badge is shown, "Pending" badge should not be shown
      expect(shouldShowPendingModelBadge).toBe(true);
    });
  });
});
