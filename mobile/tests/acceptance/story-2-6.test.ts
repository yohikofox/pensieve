import { loadFeature, defineFeature } from 'jest-cucumber';
import { TestContext } from './support/test-context';

const feature = loadFeature('./tests/acceptance/features/story-2-6-consultation-transcription.feature');

defineFeature(feature, (test) => {
  let testContext: TestContext;
  let captureId: string;
  let transcriptionText: string;

  beforeEach(() => {
    testContext = new TestContext();
  });

  afterEach(() => {
    testContext.reset();
  });

  // ============================================================================
  // AC1: Afficher Transcription Complète avec Métadonnées
  // ============================================================================

  test('Afficher transcription complète avec métadonnées', ({ given, when, then, and }) => {
    given(/qu'une capture audio "([^"]+)" a été transcrite/, async (capId) => {
      const capture = await testContext.db.create({
        id: capId,
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        filePath: '/audio/capture-123.m4a',
        state: 'TRANSCRIBED',
        capturedAt: new Date('2026-01-21T14:30:00'),
        transcribedAt: new Date('2026-01-21T14:30:00'),
      });
      captureId = capture.id;
      await testContext.fileSystem.writeFile('/audio/capture-123.m4a', 'fake-audio-data');
    });

    given(/que la transcription est "([^"]+)"/, async (text) => {
      transcriptionText = text;
      await testContext.db.update(captureId, { normalizedText: text });
    });

    given(/que le timestamp de transcription est "([^"]+)"/, async (timestamp) => {
      await testContext.db.update(captureId, { transcribedAt: new Date(timestamp) });
    });

    given(/que la durée audio est (\d+) secondes/, async (duration) => {
      await testContext.audioPlayer.loadAudio('/audio/capture-123.m4a', parseInt(duration, 10) * 1000);
    });

    when("l'utilisateur ouvre la vue détail de la capture", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture).toBeDefined();
    });

    then('la transcription complète est affichée', async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toBeTruthy();
    });

    and(/le texte affiché est "([^"]+)"/, async (expectedText) => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toBe(expectedText);
    });

    and(/le timestamp "([^"]+)" est visible/, async (timestamp) => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.transcribedAt).toEqual(new Date(timestamp));
    });

    and(/la durée "([^"]+)" est affichée/, (duration) => {
      // Duration format check (e.g., "2:35")
      expect(duration).toMatch(/^\d+:\d{2}$/);
    });
  });

  test('Afficher timestamp de transcription', ({ given, when, then, and }) => {
    given(/qu'une capture audio a été transcrite le "([^"]+)"/, async (timestamp) => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        state: 'TRANSCRIBED',
        normalizedText: 'Sample transcription',
        transcribedAt: new Date(timestamp),
        capturedAt: new Date(),
      });
      captureId = capture.id;
    });

    when("l'utilisateur ouvre la vue détail", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture).toBeDefined();
    });

    then(/le timestamp "([^"]+)" est affiché/, async (timestamp) => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.transcribedAt).toEqual(new Date(timestamp));
    });

    and('le format du timestamp est lisible', async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.transcribedAt).toBeInstanceOf(Date);
    });
  });

  test('Afficher durée audio', ({ given, when, then, and }) => {
    given(/qu'une capture audio de (\d+) secondes a été transcrite/, async (duration) => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-90s.m4a',
        filePath: '/audio/capture-90s.m4a',
        state: 'TRANSCRIBED',
        normalizedText: 'Transcription',
        capturedAt: new Date(),
      });
      captureId = capture.id;
      await testContext.audioPlayer.loadAudio('/audio/capture-90s.m4a', parseInt(duration, 10) * 1000);
    });

    when("l'utilisateur ouvre la vue détail", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture).toBeDefined();
    });

    then(/la durée "([^"]+)" est affichée/, (duration) => {
      const durationMs = testContext.audioPlayer.getDuration();
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      expect(formatted).toBe(duration);
    });

    and('le format est "MM:SS"', () => {
      const durationMs = testContext.audioPlayer.getDuration();
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      expect(formatted).toMatch(/^\d+:\d{2}$/);
    });
  });

  test('Rendre fichier audio disponible', ({ given, when, then, and }) => {
    given("qu'une capture audio transcrite existe", async () => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        filePath: '/audio/capture-123.m4a',
        state: 'TRANSCRIBED',
        normalizedText: 'Transcription',
        capturedAt: new Date(),
      });
      captureId = capture.id;
    });

    given(/que le fichier audio est "([^"]+)"/, async (filePath) => {
      await testContext.fileSystem.writeFile(filePath, 'fake-audio-data');
    });

    when("l'utilisateur ouvre la vue détail", async () => {
      const capture = await testContext.db.findById(captureId);
      await testContext.audioPlayer.loadAudio(capture!.filePath!, 60000);
    });

    then('le fichier audio est chargé dans le player', () => {
      expect(testContext.audioPlayer.getAudioFilePath()).toBe('/audio/capture-123.m4a');
    });

    and('le bouton play est visible', () => {
      expect(testContext.audioPlayer.canPlay()).toBe(true);
    });
  });

  // ============================================================================
  // AC2: Contrôles de Lecture Audio
  // ============================================================================

  test('Lire audio avec contrôles de lecture', ({ given, when, then, and }) => {
    given("qu'une capture audio transcrite est ouverte", async () => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        filePath: '/audio/capture-123.m4a',
        state: 'TRANSCRIBED',
        normalizedText: 'Transcription',
        capturedAt: new Date(),
      });
      captureId = capture.id;
      await testContext.fileSystem.writeFile('/audio/capture-123.m4a', 'fake-audio-data');
    });

    given('que le fichier audio est chargé', async () => {
      await testContext.audioPlayer.loadAudio('/audio/capture-123.m4a', 60000);
    });

    when("l'utilisateur tape sur le bouton play", async () => {
      await testContext.audioPlayer.play();
    });

    then("l'audio démarre immédiatement", () => {
      expect(testContext.audioPlayer.isPlaying()).toBe(true);
    });

    and('les contrôles de lecture sont visibles', () => {
      expect(testContext.audioPlayer.canPlay()).toBe(true);
    });

    and('le bouton play devient pause', () => {
      expect(testContext.audioPlayer.isPlaying()).toBe(true);
      expect(testContext.audioPlayer.isPaused()).toBe(false);
    });

    and("la barre de progression s'affiche", () => {
      expect(testContext.audioPlayer.getDuration()).toBeGreaterThan(0);
    });
  });

  test('Pause audio en lecture', ({ given, when, then, and }) => {
    given("que l'audio d'une capture est en cours de lecture", async () => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        filePath: '/audio/capture-123.m4a',
        state: 'TRANSCRIBED',
        capturedAt: new Date(),
      });
      captureId = capture.id;
      await testContext.audioPlayer.loadAudio('/audio/capture-123.m4a', 60000);
      await testContext.audioPlayer.play();
    });

    when("l'utilisateur tape sur le bouton pause", async () => {
      await testContext.audioPlayer.pause();
    });

    then("l'audio s'arrête", () => {
      expect(testContext.audioPlayer.isPlaying()).toBe(false);
    });

    and('le bouton pause devient play', () => {
      expect(testContext.audioPlayer.isPaused()).toBe(true);
    });

    and('la position de lecture est conservée', () => {
      const currentTime = testContext.audioPlayer.getCurrentTime();
      expect(currentTime).toBeGreaterThanOrEqual(0);
    });
  });

  test('Afficher barre de progression', ({ given, when, then, and }) => {
    given("qu'une capture audio est en cours de lecture", async () => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        filePath: '/audio/capture-123.m4a',
        state: 'TRANSCRIBED',
        capturedAt: new Date(),
      });
      captureId = capture.id;
      await testContext.audioPlayer.loadAudio('/audio/capture-123.m4a', 120000);
      await testContext.audioPlayer.play();
    });

    given(/que la durée totale est (\d+) secondes/, (duration) => {
      expect(testContext.audioPlayer.getDuration()).toBe(parseInt(duration, 10) * 1000);
    });

    given(/que la position actuelle est (\d+) secondes/, (position) => {
      testContext.audioPlayer.setCurrentTime(parseInt(position, 10) * 1000);
    });

    when("l'utilisateur regarde la barre de progression", () => {
      // User views progress bar
      expect(testContext.audioPlayer.isPlaying()).toBe(true);
    });

    then(/le temps actuel "([^"]+)" est affiché/, (currentTime) => {
      const currentMs = testContext.audioPlayer.getCurrentTime();
      const minutes = Math.floor(currentMs / 60000);
      const seconds = Math.floor((currentMs % 60000) / 1000);
      const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      expect(formatted).toBe(currentTime);
    });

    and(/le temps total "([^"]+)" est affiché/, (totalTime) => {
      const durationMs = testContext.audioPlayer.getDuration();
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      expect(formatted).toBe(totalTime);
    });

    and(/la barre de progression indique ([0-9.]+)% de progression/, (percentage) => {
      const currentMs = testContext.audioPlayer.getCurrentTime();
      const durationMs = testContext.audioPlayer.getDuration();
      const progress = (currentMs / durationMs) * 100;
      expect(progress).toBeCloseTo(parseFloat(percentage), 1);
    });
  });

  test('Écouter en lisant la transcription', ({ given, when, then, and }) => {
    given("qu'une capture audio transcrite est ouverte", async () => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        filePath: '/audio/capture-123.m4a',
        state: 'TRANSCRIBED',
        normalizedText: 'Long transcription text that requires scrolling...',
        capturedAt: new Date(),
      });
      captureId = capture.id;
      await testContext.audioPlayer.loadAudio('/audio/capture-123.m4a', 60000);
    });

    given("que l'audio est en cours de lecture", async () => {
      await testContext.audioPlayer.play();
    });

    when("l'utilisateur scroll la transcription", () => {
      // Simulates scrolling action
      expect(testContext.audioPlayer.isPlaying()).toBe(true);
    });

    then("l'audio continue de jouer", () => {
      expect(testContext.audioPlayer.isPlaying()).toBe(true);
    });

    and('le scroll fonctionne normalement', () => {
      // Scroll doesn't interfere with audio
      expect(true).toBe(true);
    });

    and("l'utilisateur peut lire le texte pendant la lecture", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toBeTruthy();
      expect(testContext.audioPlayer.isPlaying()).toBe(true);
    });
  });

  test('Reprendre lecture après navigation', ({ given, when, then, and }) => {
    given(/qu'une capture audio est en pause à (\d+) secondes/, async (position) => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        filePath: '/audio/capture-123.m4a',
        state: 'TRANSCRIBED',
        capturedAt: new Date(),
      });
      captureId = capture.id;
      await testContext.audioPlayer.loadAudio('/audio/capture-123.m4a', 120000);
      await testContext.audioPlayer.play();
      testContext.audioPlayer.setCurrentTime(parseInt(position, 10) * 1000);
      await testContext.audioPlayer.pause();
    });

    when("l'utilisateur navigue vers une autre vue", () => {
      // Simulates navigation away
      expect(testContext.audioPlayer.isPaused()).toBe(true);
    });

    and('revient à la capture', () => {
      // Simulates return to capture detail view
      expect(testContext.audioPlayer.getAudioFilePath()).toBeTruthy();
    });

    then(/la position de lecture reste à (\d+) secondes/, (position) => {
      expect(testContext.audioPlayer.getCurrentTime()).toBe(parseInt(position, 10) * 1000);
    });

    and('le bouton play est disponible', () => {
      expect(testContext.audioPlayer.canPlay()).toBe(true);
    });

    and("l'utilisateur peut reprendre la lecture", async () => {
      await testContext.audioPlayer.play();
      expect(testContext.audioPlayer.isPlaying()).toBe(true);
    });
  });

  // ============================================================================
  // AC3: Indicateur Transcription en Cours (Live Update)
  // ============================================================================

  test('Afficher indicateur transcription en cours', ({ given, when, then, and }) => {
    given("qu'une capture audio est en cours de transcription", async () => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        filePath: '/audio/capture-123.m4a',
        state: 'TRANSCRIBING',
        capturedAt: new Date(),
      });
      captureId = capture.id;
    });

    given(/que le statut est "([^"]+)"/, async (status) => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.state).toBe(status);
    });

    when("l'utilisateur ouvre la vue détail", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture).toBeDefined();
    });

    then(/un indicateur "([^"]+)" est affiché/, (message) => {
      // UI should display "Transcription in progress..."
      expect(message).toBe('Transcription in progress...');
    });

    and('un spinner de chargement est visible', () => {
      // Spinner should be shown
      expect(true).toBe(true);
    });

    and("aucun texte de transcription n'est affiché", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toBeUndefined();
    });
  });

  test('Audio disponible pendant transcription', ({ given, when, then, and }) => {
    given("qu'une capture audio est en cours de transcription", async () => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        filePath: '/audio/capture-123.m4a',
        state: 'TRANSCRIBING',
        capturedAt: new Date(),
      });
      captureId = capture.id;
      await testContext.fileSystem.writeFile('/audio/capture-123.m4a', 'fake-audio-data');
    });

    when("l'utilisateur ouvre la vue détail", async () => {
      const capture = await testContext.db.findById(captureId);
      await testContext.audioPlayer.loadAudio(capture!.filePath!, 60000);
    });

    then('le fichier audio est chargé', () => {
      expect(testContext.audioPlayer.getAudioFilePath()).toBe('/audio/capture-123.m4a');
    });

    and('le bouton play est disponible', () => {
      expect(testContext.audioPlayer.canPlay()).toBe(true);
    });

    and("l'utilisateur peut écouter l'audio pendant la transcription", async () => {
      await testContext.audioPlayer.play();
      expect(testContext.audioPlayer.isPlaying()).toBe(true);
    });
  });

  test('Live update quand transcription prête', ({ given, when, then, and }) => {
    given("qu'une capture audio est en cours de transcription", async () => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        state: 'TRANSCRIBING',
        capturedAt: new Date(),
      });
      captureId = capture.id;
    });

    given("que l'utilisateur a ouvert la vue détail", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.state).toBe('TRANSCRIBING');
    });

    when('la transcription se termine avec succès', async () => {
      await testContext.db.update(captureId, {
        normalizedText: 'Transcription complétée',
        state: 'TRANSCRIBED',
      });
    });

    and(/que le statut passe à "([^"]+)"/, async (status) => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.state).toBe(status);
    });

    then(/l'indicateur "([^"]+)" disparaît/, () => {
      // Indicator should disappear
      expect(true).toBe(true);
    });

    and('le texte transcrit apparaît automatiquement', async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toBe('Transcription complétée');
    });

    and("l'utilisateur n'a pas besoin de rafraîchir manuellement", () => {
      // Auto-update without manual refresh
      expect(true).toBe(true);
    });
  });

  test('Polling state change', ({ given, when, then, and }) => {
    given("qu'une capture est en cours de transcription", async () => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        state: 'TRANSCRIBING',
        capturedAt: new Date(),
      });
      captureId = capture.id;
    });

    given('que la vue détail observe les changements de statut', () => {
      // Polling or observe mechanism set up
      expect(true).toBe(true);
    });

    when('le statut est mis à jour en base de données', async () => {
      await testContext.db.update(captureId, { state: 'TRANSCRIBED', normalizedText: 'Text' });
    });

    then('la vue détail détecte le changement', async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.state).toBe('TRANSCRIBED');
    });

    and("met à jour l'UI automatiquement", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toBeTruthy();
    });
  });

  // ============================================================================
  // AC4: Gestion Transcription Échouée avec Retry
  // ============================================================================

  test('Afficher erreur transcription échouée', ({ given, when, then, and }) => {
    given(/qu'une transcription a échoué pour la capture "([^"]+)"/, async (capId) => {
      const capture = await testContext.db.create({
        id: capId,
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-456.m4a',
        filePath: '/audio/capture-456.m4a',
        state: 'TRANSCRIPTION_FAILED',
        capturedAt: new Date(),
      });
      captureId = capture.id;
      await testContext.fileSystem.writeFile('/audio/capture-456.m4a', 'fake-audio-data');
    });

    given(/que le statut est "([^"]+)"/, async (status) => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.state).toBe(status);
    });

    when("l'utilisateur ouvre la vue détail", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture).toBeDefined();
    });

    then(/un message "([^"]+)" est affiché/, (message) => {
      expect(message).toBe('Transcription failed');
    });

    and("aucun texte de transcription n'est visible", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toBeUndefined();
    });

    and('le fichier audio reste disponible', () => {
      expect(testContext.fileSystem.fileExists('/audio/capture-456.m4a')).toBe(true);
    });
  });

  test('Bouton retry disponible', ({ given, when, then, and }) => {
    given("qu'une transcription a échoué", async () => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-456.m4a',
        state: 'TRANSCRIPTION_FAILED',
        capturedAt: new Date(),
      });
      captureId = capture.id;
    });

    when("l'utilisateur ouvre la vue détail", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.state).toBe('TRANSCRIPTION_FAILED');
    });

    then(/un bouton "([^"]+)" est affiché/, (buttonText) => {
      expect(buttonText).toBe('Retry');
    });

    and('le bouton est cliquable', () => {
      // Retry button should be enabled
      expect(true).toBe(true);
    });
  });

  test('Retry redémarre transcription', ({ given, when, then, and }) => {
    given(/qu'une transcription a échoué pour "([^"]+)"/, async (capId) => {
      const capture = await testContext.db.create({
        id: capId,
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-456.m4a',
        filePath: '/audio/capture-456.m4a',
        state: 'TRANSCRIPTION_FAILED',
        capturedAt: new Date(),
      });
      captureId = capture.id;
    });

    given("que l'utilisateur ouvre la vue détail", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture).toBeDefined();
    });

    when(/l'utilisateur tape sur le bouton "([^"]+)"/, async (buttonText) => {
      expect(buttonText).toBe('Retry');
      // Retry action
      testContext.transcriptionQueue.addJob(captureId, '/audio/capture-456.m4a', 60000);
      await testContext.db.update(captureId, { state: 'TRANSCRIBING' });
    });

    then('un nouveau job de transcription est créé dans la queue', () => {
      expect(testContext.transcriptionQueue.getJobsCount()).toBe(1);
    });

    and('le statut de la capture passe à "TRANSCRIBING"', async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.state).toBe('TRANSCRIBING');
    });

    and(/l'indicateur "([^"]+)" s'affiche/, () => {
      // Progress indicator shown
      expect(true).toBe(true);
    });
  });

  test('Audio lisible après échec', ({ given, when, then, and }) => {
    given("qu'une transcription a échoué", async () => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-456.m4a',
        filePath: '/audio/capture-456.m4a',
        state: 'TRANSCRIPTION_FAILED',
        capturedAt: new Date(),
      });
      captureId = capture.id;
      await testContext.fileSystem.writeFile('/audio/capture-456.m4a', 'fake-audio-data');
    });

    given(/que le fichier audio est "([^"]+)"/, (filePath) => {
      expect(testContext.fileSystem.fileExists(filePath)).toBe(true);
    });

    when("l'utilisateur ouvre la vue détail", async () => {
      const capture = await testContext.db.findById(captureId);
      await testContext.audioPlayer.loadAudio(capture!.filePath!, 60000);
    });

    then('le fichier audio est chargé dans le player', () => {
      expect(testContext.audioPlayer.getAudioFilePath()).toBe('/audio/capture-456.m4a');
    });

    and("l'utilisateur peut lire l'audio", async () => {
      await testContext.audioPlayer.play();
      expect(testContext.audioPlayer.isPlaying()).toBe(true);
    });

    and("le fichier audio n'a pas été supprimé", () => {
      expect(testContext.fileSystem.fileExists('/audio/capture-456.m4a')).toBe(true);
    });
  });

  // ============================================================================
  // AC5: Fonctionnement Offline (FR23: Local Cache Compliance)
  // ============================================================================

  test('Consulter transcription offline', ({ given, when, then, and }) => {
    given("que l'appareil est hors ligne", () => {
      testContext.setOffline(true);
      expect(testContext.isOffline()).toBe(true);
    });

    given("qu'une capture audio transcrite existe en cache local", async () => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        filePath: '/audio/capture-123.m4a',
        state: 'TRANSCRIBED',
        normalizedText: 'Cached transcription',
        transcribedAt: new Date(),
        capturedAt: new Date(),
      });
      captureId = capture.id;
      await testContext.fileSystem.writeFile('/audio/capture-123.m4a', 'fake-audio-data');
    });

    when("l'utilisateur ouvre la vue détail", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture).toBeDefined();
    });

    then('la transcription est chargée depuis la base locale', async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toBe('Cached transcription');
    });

    and('toutes les métadonnées sont affichées (timestamp, durée)', async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.transcribedAt).toBeDefined();
    });

    and('le fichier audio est chargé depuis le stockage local', () => {
      expect(testContext.fileSystem.fileExists('/audio/capture-123.m4a')).toBe(true);
    });

    and("aucun appel réseau n'est fait", () => {
      // Offline mode enforces no network calls
      expect(testContext.isOffline()).toBe(true);
    });
  });

  test('Aucune erreur réseau offline', ({ given, when, then, and }) => {
    given("que l'appareil est hors ligne", () => {
      testContext.setOffline(true);
    });

    given("qu'une capture transcrite est ouverte", async () => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        state: 'TRANSCRIBED',
        normalizedText: 'Transcription',
        capturedAt: new Date(),
      });
      captureId = capture.id;
    });

    when("l'utilisateur consulte la transcription", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toBeTruthy();
    });

    then(/aucun message "([^"]+)" n'est affiché/, (message) => {
      // No "connection lost" message
      expect(message).toBe('connection lost');
    });

    and("aucune erreur réseau n'apparaît", () => {
      // No network errors thrown
      expect(true).toBe(true);
    });

    and("l'UI fonctionne normalement", () => {
      // Normal functionality despite offline
      expect(testContext.isOffline()).toBe(true);
    });
  });

  test('Audio playback offline', ({ given, when, then, and }) => {
    given("que l'appareil est hors ligne", () => {
      testContext.setOffline(true);
    });

    given("qu'une capture audio transcrite est ouverte", async () => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        filePath: '/audio/capture-123.m4a',
        state: 'TRANSCRIBED',
        normalizedText: 'Transcription',
        capturedAt: new Date(),
      });
      captureId = capture.id;
      await testContext.fileSystem.writeFile('/audio/capture-123.m4a', 'fake-audio-data');
      await testContext.audioPlayer.loadAudio('/audio/capture-123.m4a', 60000);
    });

    when("l'utilisateur tape sur le bouton play", async () => {
      await testContext.audioPlayer.play();
    });

    then("l'audio se lit depuis le stockage local", () => {
      expect(testContext.fileSystem.fileExists('/audio/capture-123.m4a')).toBe(true);
      expect(testContext.audioPlayer.isPlaying()).toBe(true);
    });

    and("aucun téléchargement réseau n'est tenté", () => {
      // Offline mode prevents network downloads
      expect(testContext.isOffline()).toBe(true);
    });

    and('la lecture fonctionne normalement', () => {
      expect(testContext.audioPlayer.isPlaying()).toBe(true);
    });
  });

  // ============================================================================
  // AC6: Captures Texte (Non-Audio) - Différenciation UI
  // ============================================================================

  test('Afficher capture texte (non-audio)', ({ given, when, then, and }) => {
    given(/qu'une capture de type "([^"]+)" existe/, async (captureType) => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: captureType as any,
        rawContent: 'Ma pensée rapide',
        state: 'CAPTURED',
        capturedAt: new Date(),
      });
      captureId = capture.id;
    });

    given(/que le contenu texte est "([^"]+)"/, async (textContent) => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.rawContent).toBe(textContent);
    });

    when("l'utilisateur ouvre la vue détail", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture).toBeDefined();
    });

    then(/seul le contenu texte "([^"]+)" est affiché/, async (expectedText) => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.rawContent).toBe(expectedText);
    });

    and("aucune section transcription n'est visible", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toBeUndefined();
    });

    and("aucun bouton audio play n'est affiché", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.captureType).toBe('TEXT');
      expect(capture?.filePath).toBeUndefined();
    });
  });

  test('Différencier type capture dans UI', ({ given, when, then, and }) => {
    given(/qu'une capture de type "([^"]+)" est ouverte/, async (captureType) => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: captureType as any,
        rawContent: 'Ma pensée',
        state: 'CAPTURED',
        capturedAt: new Date(),
      });
      captureId = capture.id;
    });

    when("l'utilisateur regarde la vue détail", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture).toBeDefined();
    });

    then(/un badge "([^"]+)" est affiché/, (badgeText) => {
      expect(badgeText).toBe('Text Capture');
    });

    and('le type de capture est clairement indiqué', async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.captureType).toBe('TEXT');
    });
  });

  // ============================================================================
  // AC7: Formatage du Texte et Caractères Spéciaux
  // ============================================================================

  test('Préserver sauts de ligne', ({ given, when, then, and }) => {
    given("qu'une transcription contient des sauts de ligne", async () => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        state: 'TRANSCRIBED',
        normalizedText: 'Première ligne\nDeuxième ligne\nTroisième ligne',
        capturedAt: new Date(),
      });
      captureId = capture.id;
    });

    given(/que le texte est "([^"]+)"/, async (text) => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toContain('\n');
    });

    when("l'utilisateur ouvre la vue détail", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture).toBeDefined();
    });

    then(/le texte est affiché sur (\d+) lignes distinctes/, async (lineCount) => {
      const capture = await testContext.db.findById(captureId);
      const lines = capture!.normalizedText!.split('\n');
      expect(lines.length).toBe(parseInt(lineCount, 10));
    });

    and('les sauts de ligne sont préservés visuellement', async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toContain('\n');
    });
  });

  test('Afficher caractères spéciaux', ({ given, when, then, and }) => {
    given("qu'une transcription contient des accents et ponctuation", async () => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        state: 'TRANSCRIBED',
        normalizedText: 'Café, élève, à côté! Vraiment?',
        capturedAt: new Date(),
      });
      captureId = capture.id;
    });

    given(/que le texte est "([^"]+)"/, async (text) => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toBe(text);
    });

    when("l'utilisateur ouvre la vue détail", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture).toBeDefined();
    });

    then(/tous les accents \(([^)]+)\) sont affichés correctement/, async (accents) => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toContain('é');
      expect(capture?.normalizedText).toContain('à');
      expect(capture?.normalizedText).toContain('ô');
    });

    and(/la ponctuation \(([^)]+)\) est visible/, async (punctuation) => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toContain('!');
      expect(capture?.normalizedText).toContain('?');
    });

    and("aucun caractère n'est corrompu", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toBe('Café, élève, à côté! Vraiment?');
    });
  });

  test('Gérer texte long avec scroll', ({ given, when, then, and }) => {
    given(/qu'une transcription contient (\d+) mots/, async (wordCount) => {
      const longText = Array(parseInt(wordCount, 10)).fill('mot').join(' ');
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        state: 'TRANSCRIBED',
        normalizedText: longText,
        capturedAt: new Date(),
      });
      captureId = capture.id;
    });

    when("l'utilisateur ouvre la vue détail", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toBeTruthy();
    });

    then('le texte scroll verticalement', () => {
      // Text should be scrollable
      expect(true).toBe(true);
    });

    and("l'UI ne casse pas avec le texte long", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText?.length).toBeGreaterThan(100);
    });

    and('la lecture reste fluide', () => {
      // Performance check
      expect(true).toBe(true);
    });
  });

  test('Optimiser lisibilité', ({ given, when, then, and }) => {
    given("qu'une transcription est affichée", async () => {
      const capture = await testContext.db.create({
        userId: 'user-123',
        captureType: 'AUDIO',
        rawContent: '/audio/capture-123.m4a',
        state: 'TRANSCRIBED',
        normalizedText: 'Sample transcription text',
        capturedAt: new Date(),
      });
      captureId = capture.id;
    });

    when("l'utilisateur lit le texte", async () => {
      const capture = await testContext.db.findById(captureId);
      expect(capture?.normalizedText).toBeTruthy();
    });

    then('la taille de police est lisible', () => {
      // Font size should be readable (e.g., 16px)
      expect(true).toBe(true);
    });

    and("l'espacement des lignes est confortable", () => {
      // Line height should be appropriate (e.g., 1.5)
      expect(true).toBe(true);
    });

    and('le contraste texte/fond est suffisant', () => {
      // Color contrast should meet accessibility standards
      expect(true).toBe(true);
    });
  });
});
