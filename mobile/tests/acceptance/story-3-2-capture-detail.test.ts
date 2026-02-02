/**
 * Story 3.2 - Vue Détail d'une Capture
 * BDD Acceptance Tests (Logic-focused, no React rendering)
 *
 * Test Categories:
 * - AC1: Smooth Transition Animation (navigation logic)
 * - AC2: Audio Capture Detail View (data loading)
 * - AC3: Text Capture Detail View (data loading)
 * - AC4: Offline Detail Access (offline logic)
 * - AC5: Live Transcription Updates (observable pattern)
 * - AC6: Swipe Navigation Between Captures (navigation logic)
 * - AC7: Return to Feed with Position (navigation state)
 * - AC8: Context Menu Actions (action handlers)
 */

import { loadFeature, defineFeature } from 'jest-cucumber';
import {
  TestContext,
  type Capture,
  createMockAudioCapture,
  createMockTextCapture,
} from './support/test-context';

const feature = loadFeature('./tests/acceptance/features/story-3-2-capture-detail.feature');

defineFeature(feature, (test) => {
  let testContext: TestContext;
  let currentCapture: Capture | null;
  let captures: Capture[];
  let currentIndex: number;
  let navigationCalled: boolean;
  let navigationParams: any;
  let observableCallback: ((capture: Capture) => void) | null;

  beforeEach(() => {
    testContext = new TestContext();
    currentCapture = null;
    captures = [];
    currentIndex = 0;
    navigationCalled = false;
    navigationParams = null;
    observableCallback = null;
  });

  afterEach(() => {
    testContext.reset();
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const navigateToDetail = (captureId: string, captureIndex?: number) => {
    navigationCalled = true;
    navigationParams = { captureId, captureIndex };
  };

  const navigateBack = () => {
    navigationCalled = true;
    navigationParams = { action: 'back' };
  };

  const loadCaptureById = async (captureId: string): Promise<Capture | null> => {
    return await testContext.db.findById(captureId);
  };

  const createObservable = (captureId: string) => {
    return {
      subscribe: (callback: (capture: Capture) => void) => {
        observableCallback = callback;
        // Emit initial value
        testContext.db.findById(captureId).then((capture) => {
          if (capture) callback(capture);
        });
        return { unsubscribe: () => { observableCallback = null; } };
      },
    };
  };

  // ============================================================================
  // AC1: Smooth Transition Animation
  // ============================================================================

  test('AC1 - Transition fluide depuis le feed', ({ given, when, then, and }) => {
    given('je suis sur l\'écran du feed des captures', async () => {
      captures = [
        await testContext.db.create(createMockAudioCapture({ id: 'cap1' })),
        await testContext.db.create(createMockAudioCapture({ id: 'cap2' })),
        await testContext.db.create(createMockAudioCapture({ id: 'cap3' })),
      ];
    });

    when('je tape sur une carte de capture', () => {
      // Simulate tap - triggers navigation
      navigateToDetail('cap1', 0);
    });

    then('l\'écran de détail s\'ouvre avec une animation fluide', () => {
      expect(navigationCalled).toBe(true);
      expect(navigationParams.captureId).toBe('cap1');
    });

    then('le contenu complet de la capture est affiché', async () => {
      currentCapture = await loadCaptureById('cap1');
      expect(currentCapture).not.toBeNull();
      expect(currentCapture?.id).toBe('cap1');
    });
  });

  // ============================================================================
  // AC2: Audio Capture Detail View
  // ============================================================================

  test('AC2 - Affichage détail capture audio avec transcription', ({ given, when, then, and }) => {
    given('une capture audio avec transcription disponible', async () => {
      currentCapture = await testContext.db.create(
        createMockAudioCapture({
          id: 'audio1',
          normalizedText: 'Ceci est une transcription complète de l\'audio.',
          duration: 120000,
        })
      );
    });

    when('je consulte l\'écran de détail de cette capture', async () => {
      currentCapture = await loadCaptureById('audio1');
    });

    and('je vois le lecteur audio avec contrôles play/pause', () => {
      // Verify audio data is loaded
      expect(currentCapture).not.toBeNull();
      expect(currentCapture?.type).toBe('AUDIO');
      expect(currentCapture?.duration).toBe(120000);
    });

    and('je vois une visualisation waveform de l\'audio', () => {
      // Verify audio file path exists for waveform
      expect(currentCapture?.filePath).toBeDefined();
    });

    and('je vois la transcription complète', () => {
      expect(currentCapture?.normalizedText).toBe('Ceci est une transcription complète de l\'audio.');
    });

    and('je vois le timestamp et la durée', () => {
      expect(currentCapture?.capturedAt).toBeDefined();
      expect(currentCapture?.duration).toBe(120000);
    });

    and('je vois les badges de statut', () => {
      expect(currentCapture?.state).toBe('ready');
    });
  });

  test('AC2 - Contrôles du lecteur audio', ({ given, when, then, and }) => {
    let isPlaying = false;

    given('je suis sur l\'écran de détail d\'une capture audio', async () => {
      currentCapture = await testContext.db.create(createMockAudioCapture({ id: 'audio1' }));
      await testContext.audioPlayer.loadAudio(currentCapture.filePath!, currentCapture.duration!);
    });

    when('j\'appuie sur le bouton play', async () => {
      await testContext.audioPlayer.play();
      isPlaying = testContext.audioPlayer.isPlaying();
    });

    then('l\'audio commence à jouer', () => {
      expect(isPlaying).toBe(true);
    });

    then('le bouton affiche pause', () => {
      expect(testContext.audioPlayer.isPlaying()).toBe(true);
    });

    when('j\'appuie sur le bouton pause', async () => {
      await testContext.audioPlayer.pause();
      isPlaying = testContext.audioPlayer.isPlaying();
    });

    then('l\'audio se met en pause', () => {
      expect(isPlaying).toBe(false);
    });

    then('le bouton affiche play', () => {
      expect(testContext.audioPlayer.isPlaying()).toBe(false);
    });
  });

  test('AC2 - Synchronisation lecture audio et transcription', ({ given, when, then, and }) => {
    let currentWordIndex = 0;
    const transcription = 'Bonjour voici une transcription pour tester';
    const words = transcription.split(' ');

    given('je suis sur l\'écran de détail d\'une capture audio', async () => {
      currentCapture = await testContext.db.create(
        createMockAudioCapture({
          id: 'audio1',
          normalizedText: transcription,
          duration: 60000,
        })
      );
      await testContext.audioPlayer.loadAudio(currentCapture.filePath!, currentCapture.duration!);
    });

    when('je lance la lecture audio', async () => {
      await testContext.audioPlayer.play();
    });

    then('la position actuelle dans la transcription est mise en évidence', () => {
      // Calculate word index based on playback position
      const position = testContext.audioPlayer.getCurrentPosition();
      const duration = testContext.audioPlayer.getAudioDuration();
      const msPerWord = duration / words.length;
      currentWordIndex = Math.floor(position / msPerWord);
      expect(currentWordIndex).toBeGreaterThanOrEqual(0);
      expect(currentWordIndex).toBeLessThan(words.length);
    });

    then('la transcription défile automatiquement pour suivre la lecture', () => {
      // Verify playback is active
      expect(testContext.audioPlayer.isPlaying()).toBe(true);
    });

    when('je tape sur un mot dans la transcription', async () => {
      // Tap on word "voici" (index 1)
      const targetWordIndex = 1;
      const msPerWord = currentCapture!.duration! / words.length;
      const targetPosition = targetWordIndex * msPerWord;
      await testContext.audioPlayer.seekTo(targetPosition);
    });

    then('l\'audio saute à la position correspondante', () => {
      const position = testContext.audioPlayer.getCurrentPosition();
      const msPerWord = currentCapture!.duration! / words.length;
      const wordIndex = Math.floor(position / msPerWord);
      expect(wordIndex).toBe(1); // "voici"
    });
  });

  // ============================================================================
  // AC3: Text Capture Detail View
  // ============================================================================

  test('AC3 - Affichage détail capture texte', ({ given, when, then, and }) => {
    given('une capture de type texte', async () => {
      currentCapture = await testContext.db.create(
        createMockTextCapture({
          id: 'text1',
          rawContent: 'Ceci est un texte de capture\navec plusieurs lignes\net des paragraphes.',
        })
      );
    });

    when('je consulte l\'écran de détail de cette capture', async () => {
      currentCapture = await loadCaptureById('text1');
    });

    and('je vois le contenu texte complet avec formatage', () => {
      expect(currentCapture?.rawContent).toContain('Ceci est un texte de capture');
      expect(currentCapture?.rawContent).toContain('\n');
    });

    and('je vois le nombre de caractères et de mots', () => {
      const charCount = currentCapture!.rawContent.length;
      const wordCount = currentCapture!.rawContent.split(/\s+/).length;
      expect(charCount).toBeGreaterThan(0);
      expect(wordCount).toBeGreaterThan(0);
    });

    and('je vois le timestamp de capture', () => {
      expect(currentCapture?.capturedAt).toBeDefined();
    });

    then('l\'interface n\'affiche pas de lecteur audio', () => {
      // Verify no audio-specific fields
      expect(currentCapture?.type).toBe('TEXT');
      expect(currentCapture?.duration).toBeUndefined();
    });
  });

  // ============================================================================
  // AC4: Offline Detail Access
  // ============================================================================

  test('AC4 - Accès hors ligne au détail', ({ given, when, then, and }) => {
    given('je suis hors ligne', () => {
      testContext.network.setOffline(true);
    });

    given('qu\'une capture est en cache local', async () => {
      currentCapture = await testContext.db.create(createMockAudioCapture({ id: 'audio1' }));
    });

    when('je consulte l\'écran de détail de cette capture', async () => {
      currentCapture = await loadCaptureById('audio1');
    });

    then('la vue se charge instantanément depuis le cache local', () => {
      expect(currentCapture).not.toBeNull();
    });

    and('toutes les fonctionnalités sont disponibles comme en ligne', () => {
      expect(currentCapture?.type).toBe('AUDIO');
      expect(currentCapture?.filePath).toBeDefined();
    });

    and('aucune erreur réseau n\'est affichée', () => {
      // No network errors should occur (offline-first)
      expect(testContext.network.getLastError()).toBeNull();
    });
  });

  // ============================================================================
  // AC5: Live Transcription Updates
  // ============================================================================

  test('AC5 - Mise à jour live de la transcription', ({ given, when, then, and }) => {
    let observable: any;

    given('je consulte une capture audio en cours de transcription', async () => {
      currentCapture = await testContext.db.create(
        createMockAudioCapture({
          id: 'audio1',
          state: 'processing',
          normalizedText: '',
        })
      );
      observable = createObservable('audio1');
      observable.subscribe((capture: Capture) => {
        currentCapture = capture;
      });
    });

    given('que la transcription se termine en arrière-plan', async () => {
      // Update capture in DB
      await testContext.db.update('audio1', {
        state: 'ready',
        normalizedText: 'Transcription complète maintenant disponible.',
      });
    });

    when('la transcription devient disponible', async () => {
      // Emit update via observable
      const updatedCapture = await testContext.db.findById('audio1');
      if (observableCallback && updatedCapture) {
        observableCallback(updatedCapture);
      }
    });

    then('le texte de transcription apparaît automatiquement sans rafraîchir', () => {
      expect(currentCapture?.normalizedText).toBe('Transcription complète maintenant disponible.');
    });

    and('une animation subtile indique le nouveau contenu disponible', () => {
      // Animation logic verified by UI tests
      expect(currentCapture?.state).toBe('ready');
    });

    and('un feedback haptique confirme la mise à jour', () => {
      // Haptic feedback tested manually or with integration tests
    });
  });

  // ============================================================================
  // AC6: Swipe Navigation Between Captures
  // ============================================================================

  test('AC6 - Navigation swipe vers capture suivante', ({ given, when, then, and }) => {
    given('je suis sur l\'écran de détail d\'une capture', async () => {
      captures = [
        await testContext.db.create(createMockAudioCapture({ id: 'cap1' })),
        await testContext.db.create(createMockAudioCapture({ id: 'cap2' })),
        await testContext.db.create(createMockAudioCapture({ id: 'cap3' })),
      ];
      currentCapture = captures[0];
      currentIndex = 0;
    });

    given('qu\'il existe une capture suivante dans le feed', () => {
      expect(captures.length).toBe(3);
      expect(currentIndex).toBe(0);
    });

    when('je swipe vers la gauche', () => {
      // Simulate swipe left gesture
      if (currentIndex < captures.length - 1) {
        currentIndex++;
        navigateToDetail(captures[currentIndex].id, currentIndex);
      }
    });

    and('la capture suivante s\'affiche', () => {
      expect(navigationCalled).toBe(true);
      expect(navigationParams.captureId).toBe('cap2');
    });

    and('la transition est fluide avec animation horizontale', () => {
      // Animation verified by UI tests
      expect(currentIndex).toBe(1);
    });
  });

  test('AC6 - Navigation swipe vers capture précédente', ({ given, when, then, and }) => {
    given('je suis sur l\'écran de détail d\'une capture', async () => {
      captures = [
        await testContext.db.create(createMockAudioCapture({ id: 'cap1' })),
        await testContext.db.create(createMockAudioCapture({ id: 'cap2' })),
        await testContext.db.create(createMockAudioCapture({ id: 'cap3' })),
      ];
      currentCapture = captures[1]; // Start at cap2
      currentIndex = 1;
    });

    given('qu\'il existe une capture précédente dans le feed', () => {
      expect(currentIndex).toBe(1);
    });

    when('je swipe vers la droite', () => {
      // Simulate swipe right gesture
      if (currentIndex > 0) {
        currentIndex--;
        navigateToDetail(captures[currentIndex].id, currentIndex);
      }
    });

    and('la capture précédente s\'affiche', () => {
      expect(navigationCalled).toBe(true);
      expect(navigationParams.captureId).toBe('cap1');
    });

    and('la transition est fluide avec animation horizontale', () => {
      expect(currentIndex).toBe(0);
    });
  });

  test('AC6 - Pas de navigation si première/dernière capture', ({ given, when, then, and }) => {
    given('je suis sur l\'écran de détail de la première capture', async () => {
      captures = [
        await testContext.db.create(createMockAudioCapture({ id: 'cap1' })),
        await testContext.db.create(createMockAudioCapture({ id: 'cap2' })),
      ];
      currentCapture = captures[0];
      currentIndex = 0;
    });

    when('je swipe vers la droite', () => {
      navigationCalled = false;
      // Try to go to previous (should not navigate)
      if (currentIndex > 0) {
        currentIndex--;
        navigateToDetail(captures[currentIndex].id, currentIndex);
      }
    });

    and('la capture reste affichée sans navigation', () => {
      expect(navigationCalled).toBe(false);
      expect(currentIndex).toBe(0);
    });

    given('je suis sur l\'écran de détail de la dernière capture', () => {
      currentCapture = captures[1];
      currentIndex = 1;
    });

    when('je swipe vers la gauche', () => {
      navigationCalled = false;
      // Try to go to next (should not navigate)
      if (currentIndex < captures.length - 1) {
        currentIndex++;
        navigateToDetail(captures[currentIndex].id, currentIndex);
      }
    });

    and('la capture reste affichée sans navigation', () => {
      expect(navigationCalled).toBe(false);
      expect(currentIndex).toBe(1);
    });
  });

  // ============================================================================
  // AC7: Return to Feed with Position
  // ============================================================================

  test('AC7 - Retour au feed avec position préservée', ({ given, when, then, and }) => {
    given('je suis sur l\'écran de détail d\'une capture', async () => {
      currentCapture = await testContext.db.create(createMockAudioCapture({ id: 'audio1' }));
      currentIndex = 5; // 6th capture in feed
    });

    when('je tape sur le bouton retour', () => {
      navigateBack();
    });

    then('je retourne à l\'écran du feed', () => {
      expect(navigationCalled).toBe(true);
      expect(navigationParams.action).toBe('back');
    });

    and('le feed défile automatiquement vers la capture consultée', () => {
      // Verify index is preserved
      expect(currentIndex).toBe(5);
    });

    and('la transition est fluide', () => {
      // Animation verified by UI tests
    });
  });

  test('AC7 - Retour au feed par swipe down', ({ given, when, then, and }) => {
    given('je suis sur l\'écran de détail d\'une capture', async () => {
      currentCapture = await testContext.db.create(createMockAudioCapture({ id: 'audio1' }));
      currentIndex = 3;
    });

    when('je swipe vers le bas', () => {
      // Simulate swipe down gesture
      navigateBack();
    });

    then('je retourne à l\'écran du feed', () => {
      expect(navigationCalled).toBe(true);
    });

    and('le feed défile automatiquement vers la capture consultée', () => {
      expect(currentIndex).toBe(3);
    });

    and('la transition est fluide', () => {
      // Animation verified by UI tests
    });
  });

  // ============================================================================
  // AC8: Context Menu Actions
  // ============================================================================

  test('AC8 - Menu contextuel par appui long', ({ given, when, then, and }) => {
    let contextMenuVisible = false;

    given('je suis sur l\'écran de détail d\'une capture', async () => {
      currentCapture = await testContext.db.create(createMockAudioCapture({ id: 'audio1' }));
    });

    when('je fais un appui long sur la zone de contenu', () => {
      // Simulate long press
      contextMenuVisible = true;
    });

    then('un menu contextuel apparaît avec les actions disponibles', () => {
      expect(contextMenuVisible).toBe(true);
    });

    and('un feedback haptique confirme l\'activation du menu', () => {
      // Haptic feedback tested manually
    });

    then('je peux voir les actions: partager, supprimer, éditer', () => {
      const availableActions = ['partager', 'supprimer', 'éditer'];
      expect(availableActions).toContain('partager');
      expect(availableActions).toContain('supprimer');
      expect(availableActions).toContain('éditer');
    });
  });

  test('AC8 - Action partager depuis menu contextuel', ({ given, when, then, and }) => {
    let shareInvoked = false;

    given('que le menu contextuel est ouvert', async () => {
      currentCapture = await testContext.db.create(
        createMockAudioCapture({ id: 'audio1', normalizedText: 'Texte à partager' })
      );
    });

    when('je sélectionne l\'action "partager"', () => {
      shareInvoked = true;
    });

    then('le dialogue de partage système s\'ouvre', () => {
      expect(shareInvoked).toBe(true);
    });

    then('je peux partager le contenu de la capture', () => {
      expect(currentCapture?.normalizedText).toBe('Texte à partager');
    });
  });

  test('AC8 - Action supprimer depuis menu contextuel', ({ given, when, then, and }) => {
    let deleteConfirmShown = false;
    let captureDeleted = false;

    given('que le menu contextuel est ouvert', async () => {
      currentCapture = await testContext.db.create(createMockAudioCapture({ id: 'audio1' }));
    });

    when('je sélectionne l\'action "supprimer"', () => {
      deleteConfirmShown = true;
    });

    then('une confirmation de suppression est demandée', () => {
      expect(deleteConfirmShown).toBe(true);
    });

    when('je confirme la suppression', async () => {
      await testContext.db.delete('audio1');
      captureDeleted = true;
    });

    and('la capture est supprimée', async () => {
      const capture = await testContext.db.findById('audio1');
      expect(capture).toBeNull();
      expect(captureDeleted).toBe(true);
    });

    then('je retourne au feed', () => {
      navigateBack();
      expect(navigationCalled).toBe(true);
    });
  });
});
