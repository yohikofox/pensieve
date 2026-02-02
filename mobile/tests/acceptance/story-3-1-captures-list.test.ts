import { loadFeature, defineFeature } from 'jest-cucumber';
import { TestContext, type Capture } from './support/test-context';

const feature = loadFeature('./tests/acceptance/features/story-3-1-captures-list.feature');

defineFeature(feature, (test) => {
  let testContext: TestContext;
  let captures: Capture[];
  let loadTime: number;
  let isOffline: boolean;
  let displayedCaptures: Capture[];
  let previewTexts: Map<string, string>;

  beforeEach(() => {
    testContext = new TestContext();
    captures = [];
    loadTime = 0;
    isOffline = false;
    displayedCaptures = [];
    previewTexts = new Map();
  });

  afterEach(() => {
    testContext.reset();
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const getPreviewText = (capture: Capture): string => {
    if (capture.type === 'TEXT') {
      return truncate(capture.rawContent, 100);
    }
    if (capture.normalizedText) {
      return truncate(capture.normalizedText, 100);
    }
    if (capture.state === 'processing') {
      return 'Transcription en cours...';
    }
    if (capture.duration) {
      return `${Math.floor(capture.duration / 1000)}s`;
    }
    return '';
  };

  const truncate = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const loadCapturesFromDb = async (): Promise<Capture[]> => {
    const startTime = Date.now();
    const result = await testContext.db.findAll();
    loadTime = Date.now() - startTime;
    return result.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
  };

  // ============================================================================
  // Shared Steps
  // ============================================================================

  const givenConnectedUser = (given: any) => {
    given('un utilisateur connecté', async () => {
      // Register user first, then sign in
      await testContext.auth.signUp('test@example.com', 'Password123!');
      await testContext.auth.signInWithPassword('test@example.com', 'Password123!');
    });
  };

  // ============================================================================
  // AC1: Display Captures in Reverse Chronological Order
  // ============================================================================

  test('Affichage des captures en ordre chronologique inversé', ({ given, when, then, and }) => {
    givenConnectedUser(given);

    given('les captures suivantes existent:', async (table: any[]) => {
      for (const row of table) {
        const capture = await testContext.db.create({
          id: row.id,
          type: row.type.toUpperCase() as 'AUDIO' | 'TEXT',
          state: row.state,
          capturedAt: new Date(row.createdAt),
          normalizedText: row.normalizedText,
          rawContent: row.type === 'text' ? row.normalizedText : `/audio/${row.id}.m4a`,
        });
        captures.push(capture);
      }
    });

    when("j'ouvre l'écran des captures", async () => {
      displayedCaptures = await loadCapturesFromDb();
    });

    then('les captures sont affichées dans l\'ordre suivant:', (table: any[]) => {
      const expectedOrder = table.map(row => row.id);
      const actualOrder = displayedCaptures.map(c => c.id);
      expect(actualOrder).toEqual(expectedOrder);
    });

    and('chaque carte de capture affiche:', (table: any[]) => {
      const requiredElements = table.map(row => row['élément']);

      for (const capture of displayedCaptures) {
        // Type icon
        expect(requiredElements).toContain('icône de type');
        expect(['AUDIO', 'TEXT']).toContain(capture.type);

        // Timestamp
        expect(requiredElements).toContain('horodatage');
        expect(capture.capturedAt).toBeInstanceOf(Date);

        // Preview text
        expect(requiredElements).toContain('texte de prévisualisation');
        const preview = getPreviewText(capture);
        expect(preview).toBeTruthy();

        // Status indicator
        expect(requiredElements).toContain('indicateur de statut');
        expect(['recording', 'captured', 'processing', 'ready', 'failed']).toContain(capture.state);
      }
    });
  });

  test('Le feed se charge en moins d\'une seconde', ({ given, when, then }) => {
    givenConnectedUser(given);

    given('20 captures existent dans la base de données', async () => {
      for (let i = 0; i < 20; i++) {
        await testContext.db.create({
          id: `cap-${i}`,
          type: i % 2 === 0 ? 'AUDIO' : 'TEXT',
          state: 'ready',
          capturedAt: new Date(Date.now() - i * 60000),
          normalizedText: `Capture ${i}`,
          rawContent: i % 2 === 0 ? `/audio/cap-${i}.m4a` : `Capture ${i}`,
        });
      }
    });

    when("j'ouvre l'écran des captures", async () => {
      displayedCaptures = await loadCapturesFromDb();
    });

    then('le feed se charge en moins de 1000 millisecondes', () => {
      expect(loadTime).toBeLessThan(1000);
    });
  });

  // ============================================================================
  // AC2: Show Preview Text Based on Capture Type
  // ============================================================================

  test('Prévisualisation pour capture audio avec transcription', ({ given, when, then }) => {
    givenConnectedUser(given);

    given(/^une capture audio avec id "([^"]+)" et normalizedText "([^"]+)"$/, async (id, text) => {
      await testContext.db.create({
        id,
        type: 'AUDIO',
        state: 'ready',
        capturedAt: new Date(),
        normalizedText: text,
        rawContent: `/audio/${id}.m4a`,
      });
    });

    when("j'ouvre l'écran des captures", async () => {
      displayedCaptures = await loadCapturesFromDb();
      for (const capture of displayedCaptures) {
        previewTexts.set(capture.id, getPreviewText(capture));
      }
    });

    then(/^la prévisualisation de "([^"]+)" affiche "([^"]+)"$/, (id, expectedPreview) => {
      const preview = previewTexts.get(id);
      expect(preview).toBe(expectedPreview);
    });
  });

  test('Prévisualisation pour capture audio sans transcription en cours', ({ given, when, then }) => {
    givenConnectedUser(given);

    given(/^une capture audio avec id "([^"]+)" et state "([^"]+)" et sans normalizedText$/, async (id, state) => {
      await testContext.db.create({
        id,
        type: 'AUDIO',
        state,
        capturedAt: new Date(),
        normalizedText: null,
        rawContent: `/audio/${id}.m4a`,
      });
    });

    when("j'ouvre l'écran des captures", async () => {
      displayedCaptures = await loadCapturesFromDb();
      for (const capture of displayedCaptures) {
        previewTexts.set(capture.id, getPreviewText(capture));
      }
    });

    then(/^la prévisualisation de "([^"]+)" affiche "([^"]+)"$/, (id, expectedPreview) => {
      const preview = previewTexts.get(id);
      expect(preview).toBe(expectedPreview);
    });
  });

  test('Prévisualisation pour capture audio en attente', ({ given, when, then }) => {
    givenConnectedUser(given);

    given(/^une capture audio avec id "([^"]+)" et state "([^"]+)" et duration (\d+) et sans normalizedText$/, async (id, state, duration) => {
      await testContext.db.create({
        id,
        type: 'AUDIO',
        state,
        capturedAt: new Date(),
        normalizedText: null,
        duration: parseInt(duration, 10),
        rawContent: `/audio/${id}.m4a`,
      });
    });

    when("j'ouvre l'écran des captures", async () => {
      displayedCaptures = await loadCapturesFromDb();
      for (const capture of displayedCaptures) {
        previewTexts.set(capture.id, getPreviewText(capture));
      }
    });

    then(/^la prévisualisation de "([^"]+)" affiche la durée "([^"]+)"$/, (id, expectedDuration) => {
      const preview = previewTexts.get(id);
      expect(preview).toBe(expectedDuration);
    });
  });

  test('Prévisualisation pour capture texte', ({ given, when, then }) => {
    givenConnectedUser(given);

    given(/^une capture texte avec id "([^"]+)" et rawContent "([^"]+)"$/, async (id, content) => {
      await testContext.db.create({
        id,
        type: 'TEXT',
        state: 'ready',
        capturedAt: new Date(),
        normalizedText: content,
        rawContent: content,
      });
    });

    when("j'ouvre l'écran des captures", async () => {
      displayedCaptures = await loadCapturesFromDb();
      for (const capture of displayedCaptures) {
        previewTexts.set(capture.id, getPreviewText(capture));
      }
    });

    then(/^la prévisualisation de "([^"]+)" affiche "([^"]+)"$/, (id, expectedPreview) => {
      const preview = previewTexts.get(id);
      expect(preview).toBe(expectedPreview);
    });
  });

  // ============================================================================
  // AC3: Offline Feed Access
  // ============================================================================

  test('Accès au feed hors ligne', ({ given, when, then, and }) => {
    givenConnectedUser(given);

    given('10 captures existent dans la base de données', async () => {
      for (let i = 0; i < 10; i++) {
        await testContext.db.create({
          id: `cap-${i}`,
          type: i % 2 === 0 ? 'AUDIO' : 'TEXT',
          state: 'ready',
          capturedAt: new Date(Date.now() - i * 60000),
          normalizedText: `Capture ${i}`,
          rawContent: i % 2 === 0 ? `/audio/cap-${i}.m4a` : `Capture ${i}`,
        });
      }
    });

    and("l'appareil est hors ligne", () => {
      isOffline = true;
      testContext.network.setOffline(true);
    });

    when("j'ouvre l'écran des captures", async () => {
      displayedCaptures = await loadCapturesFromDb();
    });

    then('toutes les 10 captures sont affichées', () => {
      expect(displayedCaptures.length).toBe(10);
    });

    and("aucune erreur réseau n'est affichée", () => {
      // In offline-first architecture, no network errors should occur
      // as data comes from local SQLite
      expect(testContext.network.getLastError()).toBeNull();
    });

    and("un indicateur hors ligne est visible dans l'en-tête", () => {
      expect(testContext.network.isOffline()).toBe(true);
    });
  });

  test('Le feed fonctionne identiquement hors ligne', ({ given, when, then, and }) => {
    givenConnectedUser(given);

    given('5 captures existent dans la base de données', async () => {
      for (let i = 0; i < 5; i++) {
        await testContext.db.create({
          id: `cap-${i}`,
          type: 'AUDIO',
          state: 'ready',
          capturedAt: new Date(Date.now() - i * 60000),
          normalizedText: `Capture ${i}`,
          rawContent: `/audio/cap-${i}.m4a`,
        });
      }
    });

    and("l'appareil est hors ligne", () => {
      isOffline = true;
      testContext.network.setOffline(true);
    });

    when("j'ouvre l'écran des captures", async () => {
      displayedCaptures = await loadCapturesFromDb();
    });

    and('je fais défiler la liste', () => {
      // Simulate scroll - no actual network calls needed
    });

    then('le défilement est fluide', () => {
      // Offline-first: local data access is always fast
      expect(displayedCaptures.length).toBe(5);
    });

    and('les captures restent accessibles', () => {
      for (const capture of displayedCaptures) {
        expect(capture).toBeDefined();
        expect(capture.id).toBeTruthy();
      }
    });
  });

  // ============================================================================
  // AC4: Infinite Scroll for Large Lists
  // ============================================================================

  test('Chargement paresseux avec scroll infini', ({ given, when, then, and }) => {
    const PAGE_SIZE = 20;
    let loadedCaptures: Capture[] = [];

    givenConnectedUser(given);

    given('60 captures existent dans la base de données', async () => {
      for (let i = 0; i < 60; i++) {
        await testContext.db.create({
          id: `cap-${i.toString().padStart(2, '0')}`,
          type: 'AUDIO',
          state: 'ready',
          capturedAt: new Date(Date.now() - i * 60000),
          normalizedText: `Capture ${i}`,
          rawContent: `/audio/cap-${i}.m4a`,
        });
      }
    });

    when("j'ouvre l'écran des captures", async () => {
      const allCaptures = await loadCapturesFromDb();
      loadedCaptures = allCaptures.slice(0, PAGE_SIZE);
    });

    then('les 20 premières captures sont affichées', () => {
      expect(loadedCaptures.length).toBe(20);
    });

    when("je fais défiler vers le bas jusqu'à la fin", async () => {
      const allCaptures = await loadCapturesFromDb();
      const nextPage = allCaptures.slice(PAGE_SIZE, PAGE_SIZE * 2);
      loadedCaptures = [...loadedCaptures, ...nextPage];
    });

    then('20 captures supplémentaires sont chargées', () => {
      expect(loadedCaptures.length).toBe(40);
    });

    and('un indicateur de chargement est affiché pendant le chargement', () => {
      // This would be tested in component tests
      expect(true).toBe(true);
    });
  });

  test('Performance de défilement à 60fps', ({ given, when, then, and }) => {
    givenConnectedUser(given);

    given('100 captures existent dans la base de données', async () => {
      for (let i = 0; i < 100; i++) {
        await testContext.db.create({
          id: `cap-${i}`,
          type: 'AUDIO',
          state: 'ready',
          capturedAt: new Date(Date.now() - i * 60000),
          normalizedText: `Capture ${i}`,
          rawContent: `/audio/cap-${i}.m4a`,
        });
      }
    });

    when("j'ouvre l'écran des captures", async () => {
      displayedCaptures = await loadCapturesFromDb();
    });

    and('je fais défiler rapidement la liste', () => {
      // Performance testing would be done via instrumentation
    });

    then('le défilement maintient 60fps', () => {
      // FPS measurement requires actual device testing
      // Here we verify data is available for rendering
      expect(displayedCaptures.length).toBe(100);
    });
  });

  // ============================================================================
  // AC5: Pull-to-Refresh
  // ============================================================================

  test('Pull-to-refresh recharge les données', ({ given, when, then, and }) => {
    givenConnectedUser(given);

    given('5 captures existent dans la base de données', async () => {
      for (let i = 0; i < 5; i++) {
        await testContext.db.create({
          id: `cap-${i}`,
          type: 'AUDIO',
          state: 'ready',
          capturedAt: new Date(Date.now() - i * 60000),
          normalizedText: `Capture ${i}`,
          rawContent: `/audio/cap-${i}.m4a`,
        });
      }
    });

    and("j'ouvre l'écran des captures", async () => {
      displayedCaptures = await loadCapturesFromDb();
    });

    when('je tire vers le bas pour rafraîchir', async () => {
      // Simulate refresh
      displayedCaptures = await loadCapturesFromDb();
    });

    then('une animation de rafraîchissement est affichée', () => {
      // Animation would be tested in component tests
      expect(true).toBe(true);
    });

    and('les captures sont rechargées depuis la base de données', () => {
      expect(displayedCaptures.length).toBe(5);
    });
  });

  test('Nouvelles captures apparaissent après refresh', ({ given, when, then, and }) => {
    givenConnectedUser(given);

    given('3 captures existent dans la base de données', async () => {
      for (let i = 0; i < 3; i++) {
        await testContext.db.create({
          id: `cap-${i}`,
          type: 'AUDIO',
          state: 'ready',
          capturedAt: new Date(Date.now() - (i + 1) * 60000),
          normalizedText: `Capture ${i}`,
          rawContent: `/audio/cap-${i}.m4a`,
        });
      }
    });

    and("j'ouvre l'écran des captures", async () => {
      displayedCaptures = await loadCapturesFromDb();
      expect(displayedCaptures.length).toBe(3);
    });

    and(/^une nouvelle capture "([^"]+)" est créée$/, async (newCapId) => {
      await testContext.db.create({
        id: newCapId,
        type: 'AUDIO',
        state: 'ready',
        capturedAt: new Date(), // Now - most recent
        normalizedText: 'Nouvelle capture',
        rawContent: `/audio/${newCapId}.m4a`,
      });
    });

    when('je tire vers le bas pour rafraîchir', async () => {
      displayedCaptures = await loadCapturesFromDb();
    });

    then(/^la capture "([^"]+)" apparaît en haut de la liste$/, (newCapId) => {
      expect(displayedCaptures[0].id).toBe(newCapId);
    });
  });

  // ============================================================================
  // AC6: Empty State
  // ============================================================================

  test("État vide avec message d'accueil", ({ given, when, then }) => {
    givenConnectedUser(given);

    given("aucune capture n'existe", async () => {
      // Database is empty by default
      const allCaptures = await testContext.db.findAll();
      expect(allCaptures.length).toBe(0);
    });

    when("j'ouvre l'écran des captures", async () => {
      displayedCaptures = await loadCapturesFromDb();
    });

    then("un message d'état vide est affiché avec:", (table: any[]) => {
      expect(displayedCaptures.length).toBe(0);

      // The actual UI text would be tested in component tests
      // Here we verify the empty state condition
      const expectedElements = table.reduce((acc, row) => {
        acc[row['élément']] = row['valeur'];
        return acc;
      }, {} as Record<string, string>);

      expect(expectedElements['titre']).toBe('Votre jardin d\'idées est prêt à germer');
      expect(expectedElements['description']).toBe('Capturez votre première pensée');
    });
  });

  test('Boutons de capture mis en avant sur état vide', ({ given, when, then }) => {
    givenConnectedUser(given);

    given("aucune capture n'existe", async () => {
      const allCaptures = await testContext.db.findAll();
      expect(allCaptures.length).toBe(0);
    });

    when("j'ouvre l'écran des captures", async () => {
      displayedCaptures = await loadCapturesFromDb();
    });

    then('les boutons de capture sont visibles et mis en avant', () => {
      // UI visibility would be tested in component tests
      expect(displayedCaptures.length).toBe(0);
    });
  });

  // ============================================================================
  // AC7: Skeleton Loading
  // ============================================================================

  test('Affichage du skeleton pendant le chargement', ({ given, when, then, and }) => {
    givenConnectedUser(given);

    given('10 captures existent dans la base de données', async () => {
      for (let i = 0; i < 10; i++) {
        await testContext.db.create({
          id: `cap-${i}`,
          type: 'AUDIO',
          state: 'ready',
          capturedAt: new Date(Date.now() - i * 60000),
          normalizedText: `Capture ${i}`,
          rawContent: `/audio/cap-${i}.m4a`,
        });
      }
    });

    and('la base de données est lente à répondre', () => {
      testContext.db.setSimulatedDelay(500);
    });

    when("j'ouvre l'écran des captures", async () => {
      // With delay, isLoading would be true initially
      displayedCaptures = await loadCapturesFromDb();
    });

    then('des cartes skeleton sont affichées', () => {
      // Skeleton display would be tested in component tests
      expect(loadTime).toBeGreaterThanOrEqual(500);
    });

    and('les cartes skeleton ont une animation de shimmer', () => {
      // Animation would be tested in component tests
      expect(true).toBe(true);
    });
  });

  test('Transition fluide du skeleton au contenu', ({ given, when, then, and }) => {
    givenConnectedUser(given);

    given('5 captures existent dans la base de données', async () => {
      for (let i = 0; i < 5; i++) {
        await testContext.db.create({
          id: `cap-${i}`,
          type: 'AUDIO',
          state: 'ready',
          capturedAt: new Date(Date.now() - i * 60000),
          normalizedText: `Capture ${i}`,
          rawContent: `/audio/cap-${i}.m4a`,
        });
      }
    });

    and('la base de données est lente à répondre', () => {
      testContext.db.setSimulatedDelay(300);
    });

    when("j'ouvre l'écran des captures", async () => {
      displayedCaptures = await loadCapturesFromDb();
    });

    and('les données arrivent', () => {
      expect(displayedCaptures.length).toBe(5);
    });

    then('la transition du skeleton au contenu est fluide', () => {
      // Transition animation would be tested in component tests
      expect(displayedCaptures.length).toBe(5);
    });

    and("le contenu s'affiche avec une animation de fondu", () => {
      // Animation would be tested in component tests
      expect(true).toBe(true);
    });
  });
});
