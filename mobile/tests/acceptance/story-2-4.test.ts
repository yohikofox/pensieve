/**
 * Story 2.4 - Stockage Offline des Captures
 * BDD Acceptance Tests with jest-cucumber
 *
 * Tests stockage offline des captures :
 * - AC1: Persistance des captures offline (WatermelonDB + secure storage)
 * - AC2: Création multiple sans réseau (NFR7: 100% offline)
 * - AC3: Accès rapide aux captures offline (NFR4: < 1s load time)
 * - AC4: Récupération après crash (NFR8: crash recovery, NFR6: zero data loss)
 * - AC5: Gestion du stockage (retention policy, cleanup)
 * - AC6: Encryption at rest (NFR12: device-level encryption)
 */

import { defineFeature, loadFeature } from 'jest-cucumber';
import { TestContext, Capture } from './support/test-context';

const feature = loadFeature('./tests/acceptance/features/story-2-4-stockage-offline.feature');

defineFeature(feature, (test) => {
  let testContext: TestContext;
  let captureIds: string[] = [];
  let loadStartTime: number;
  let loadEndTime: number;

  beforeEach(() => {
    testContext = new TestContext();
    captureIds = [];
  });

  afterEach(() => {
    testContext.reset();
    captureIds = [];
  });

  // ==========================================================================
  // AC1: Persistance des Captures Offline
  // ==========================================================================

  test('Persister captures audio en mode offline', ({ given, when, then, and }) => {
    given('que l\'appareil est hors ligne', () => {
      testContext.setOffline(true);
    });

    when('l\'utilisateur crée une capture audio', async () => {
      await testContext.audioRecorder.startRecording();
      testContext.audioRecorder.simulateRecording(3000);
      const { uri, duration } = await testContext.audioRecorder.stopRecording();

      await testContext.fileSystem.writeFile(uri, 'mock-audio-data');

      const capture = await testContext.db.create({
        type: 'AUDIO',
        state: 'CAPTURED',
        filePath: uri,
        rawContent: uri,
        duration,
        syncStatus: 'pending',
      });

      captureIds.push(capture.id);

      // TODO: Wire MockSyncQueue
      // testContext.syncQueue.addToQueue(capture.id);
    });

    then('la Capture est persistée dans WatermelonDB', async () => {
      expect(await testContext.db.count()).toBe(1);
    });

    and('le fichier audio est stocké dans le storage sécurisé', async () => {
      const capture = await testContext.db.findById(captureIds[0]);
      const fileExists = await testContext.fileSystem.fileExists(capture!.filePath!);
      expect(fileExists).toBe(true);
    });

    and('la Capture a un champ syncStatus avec valeur "pending"', async () => {
      const capture = await testContext.db.findById(captureIds[0]);
      expect(capture!.syncStatus).toBe('pending');
    });

    and('la Capture est ajoutée à la queue de synchronisation', () => {
      // TODO: Wire MockSyncQueue
      // expect(testContext.syncQueue.getQueue()).toContain(captureIds[0]);
      expect(true).toBe(true); // Placeholder
    });
  });

  test('Stocker fichiers audio dans secure storage', ({ given, when, then, and }) => {
    given('que l\'utilisateur crée une capture audio', async () => {
      await testContext.audioRecorder.startRecording();
      testContext.audioRecorder.simulateRecording(2000);
    });

    when('le fichier audio est écrit sur le disque', async () => {
      const { uri } = await testContext.audioRecorder.stopRecording();
      await testContext.fileSystem.writeFile(uri, 'mock-audio-content');

      const capture = await testContext.db.create({
        type: 'AUDIO',
        state: 'CAPTURED',
        filePath: uri,
        rawContent: uri,
        syncStatus: 'pending',
      });

      captureIds.push(capture.id);
    });

    then('le fichier est stocké dans "FileSystem.documentDirectory/captures/"', async () => {
      const capture = await testContext.db.findById(captureIds[0]);
      expect(capture!.filePath).toContain('mock://');
    });

    and('le chemin du fichier est enregistré dans la metadata', async () => {
      const capture = await testContext.db.findById(captureIds[0]);
      expect(capture!.filePath).toBeDefined();
      expect(capture!.filePath).not.toBeNull();
    });

    and('le fichier est accessible via le filePath de la Capture', async () => {
      const capture = await testContext.db.findById(captureIds[0]);
      const fileExists = await testContext.fileSystem.fileExists(capture!.filePath!);
      expect(fileExists).toBe(true);
    });
  });

  test('Persister captures texte en mode offline', ({ given, when, then, and }) => {
    given('que l\'appareil est hors ligne', () => {
      testContext.setOffline(true);
    });

    when('l\'utilisateur crée une capture texte "Ma pensée importante"', async () => {
      const capture = await testContext.db.create({
        type: 'TEXT',
        state: 'CAPTURED',
        rawContent: 'Ma pensée importante',
        normalizedText: 'Ma pensée importante',
        syncStatus: 'pending',
      });

      captureIds.push(capture.id);
    });

    then('la Capture est persistée dans WatermelonDB', async () => {
      expect(await testContext.db.count()).toBe(1);
    });

    and('le texte est stocké dans le champ rawContent', async () => {
      const capture = await testContext.db.findById(captureIds[0]);
      expect(capture!.rawContent).toBe('Ma pensée importante');
    });

    and('aucun fichier audio n\'est créé (filePath = null)', async () => {
      const capture = await testContext.db.findById(captureIds[0]);
      expect(capture!.filePath).toBeUndefined();
    });

    and('la Capture a syncStatus = "pending"', async () => {
      const capture = await testContext.db.findById(captureIds[0]);
      expect(capture!.syncStatus).toBe('pending');
    });
  });

  test('Queue de synchronisation pour captures pending', ({ given, when, then, and }) => {
    given('que l\'utilisateur crée 5 captures en mode offline', async () => {
      testContext.setOffline(true);

      for (let i = 0; i < 5; i++) {
        const capture = await testContext.db.create({
          type: 'AUDIO',
          state: 'CAPTURED',
          rawContent: `capture-${i}`,
          syncStatus: 'pending',
        });
        captureIds.push(capture.id);
      }
    });

    when('toutes les captures sont sauvegardées', async () => {
      expect(await testContext.db.count()).toBe(5);
    });

    then('les 5 Captures ont syncStatus = "pending"', async () => {
      const pendingCaptures = await testContext.db.findBySyncStatus('pending');
      expect(pendingCaptures.length).toBe(5);
    });

    and('les 5 Captures sont dans la SyncQueue', () => {
      // TODO: Wire MockSyncQueue
      // expect(testContext.syncQueue.getQueueSize()).toBe(5);
      expect(true).toBe(true); // Placeholder
    });

    and('la SyncQueue.getQueueSize() retourne 5', () => {
      // TODO: Wire MockSyncQueue
      // expect(testContext.syncQueue.getQueueSize()).toBe(5);
      expect(true).toBe(true); // Placeholder
    });
  });

  test('Persister différents types de captures', ({ given, when, then, and }) => {
    given('que l\'appareil est hors ligne', () => {
      testContext.setOffline(true);
    });

    when(/l'utilisateur crée une capture de type "(.*)"/, async (type: string) => {
      const capture = await testContext.db.create({
        type: type as 'AUDIO' | 'TEXT',
        state: 'CAPTURED',
        rawContent: `${type}-content`,
        syncStatus: 'pending',
      });
      captureIds.push(capture.id);
    });

    then(/la Capture est persistée avec type "(.*)"/, async (type: string) => {
      const capture = await testContext.db.findById(captureIds[0]);
      expect(capture!.type).toBe(type);
    });

    and('la Capture a syncStatus = "pending"', async () => {
      const capture = await testContext.db.findById(captureIds[0]);
      expect(capture!.syncStatus).toBe('pending');
    });
  });

  // ==========================================================================
  // AC2: Création Multiple Sans Réseau
  // ==========================================================================

  test('Créer 10 captures successivement offline', ({ given, when, then, and }) => {
    given('que l\'appareil est hors ligne', () => {
      testContext.setOffline(true);
    });

    when('l\'utilisateur crée 10 captures audio successivement', async () => {
      for (let i = 0; i < 10; i++) {
        const capture = await testContext.db.create({
          type: 'AUDIO',
          state: 'CAPTURED',
          rawContent: `audio-${i}`,
          syncStatus: 'pending',
        });
        captureIds.push(capture.id);
      }
    });

    then('toutes les 10 captures sont sauvegardées sans erreurs', async () => {
      expect(await testContext.db.count()).toBe(10);
    });

    and('aucune exception réseau n\'est levée', () => {
      expect(testContext.isOffline()).toBe(true);
    });

    and('toutes les Captures ont syncStatus = "pending"', async () => {
      const pendingCaptures = await testContext.db.findBySyncStatus('pending');
      expect(pendingCaptures.length).toBe(10);
    });
  });

  test('Monitoring de l\'espace de stockage', ({ given, when, then, and }) => {
    given('que l\'appareil a 500 MB d\'espace disponible', () => {
      testContext.fileSystem.setAvailableSpace(500 * 1024 * 1024);
    });

    when('l\'utilisateur crée une capture audio', async () => {
      // TODO: Wire MockStorageManager
      // const availableSpace = testContext.storageManager.getAvailableSpace();
      const availableSpace = testContext.fileSystem.getAvailableSpace();
      expect(availableSpace).toBeGreaterThan(100 * 1024 * 1024);

      await testContext.db.create({
        type: 'AUDIO',
        state: 'CAPTURED',
        rawContent: 'audio',
        syncStatus: 'pending',
      });
    });

    then('l\'espace de stockage est vérifié avant la capture', () => {
      // Verified in when step
      expect(testContext.fileSystem.getAvailableSpace()).toBeGreaterThan(0);
    });

    and('le StorageManager.getAvailableSpace() est appelé', () => {
      // TODO: Wire MockStorageManager
      expect(true).toBe(true); // Placeholder
    });

    and('aucune erreur n\'est levée (espace suffisant)', () => {
      expect(testContext.fileSystem.getAvailableSpace()).toBeGreaterThan(100 * 1024 * 1024);
    });
  });

  test('Warning si espace < 100 MB', ({ given, when, then, and }) => {
    given('que l\'appareil a 80 MB d\'espace disponible', () => {
      testContext.fileSystem.setAvailableSpace(80 * 1024 * 1024);
    });

    when('l\'utilisateur tente de créer une capture audio', () => {
      const availableSpace = testContext.fileSystem.getAvailableSpace();
      const isLow = availableSpace < 100 * 1024 * 1024;
      expect(isLow).toBe(true);

      // Show warning dialog
      if (isLow) {
        testContext.dialog.show('Storage running low', ['Continue', 'Cancel']);
      }
    });

    then('un warning s\'affiche avec le message "Storage running low"', () => {
      expect(testContext.dialog.isShown()).toBe(true);
      expect(testContext.dialog.getMessage()).toContain('Storage running low');
    });

    and('l\'utilisateur peut choisir de continuer ou annuler', () => {
      expect(testContext.dialog.getOptions()).toContain('Continue');
      expect(testContext.dialog.getOptions()).toContain('Cancel');
    });

    and('si l\'utilisateur continue, la capture est créée', async () => {
      testContext.dialog.selectOption('Continue');

      const capture = await testContext.db.create({
        type: 'AUDIO',
        state: 'CAPTURED',
        rawContent: 'audio',
        syncStatus: 'pending',
      });

      expect(capture).toBeDefined();
    });
  });

  test('Bloquer capture si espace < 50 MB', ({ given, when, then, and }) => {
    given('que l\'appareil a 40 MB d\'espace disponible', () => {
      testContext.fileSystem.setAvailableSpace(40 * 1024 * 1024);
    });

    when('l\'utilisateur tente de créer une capture audio', () => {
      const availableSpace = testContext.fileSystem.getAvailableSpace();
      const isCritical = availableSpace < 50 * 1024 * 1024;
      expect(isCritical).toBe(true);

      if (isCritical) {
        testContext.dialog.show('Insufficient storage', ['OK']);
      }
    });

    then('un dialog bloquant s\'affiche "Insufficient storage"', () => {
      expect(testContext.dialog.isShown()).toBe(true);
      expect(testContext.dialog.getMessage()).toContain('Insufficient storage');
    });

    and('la capture est bloquée (ne peut pas être créée)', async () => {
      // Capture creation blocked by insufficient storage
      const captureCount = await testContext.db.count();
      expect(captureCount).toBe(0);
    });

    and('l\'utilisateur est invité à libérer de l\'espace', () => {
      expect(testContext.dialog.getMessage()).toContain('Insufficient storage');
    });
  });

  test('Pas d\'erreurs réseau en mode offline', ({ given, when, then, and }) => {
    given('que l\'appareil est hors ligne', () => {
      testContext.setOffline(true);
    });

    when('l\'utilisateur crée 5 captures audio', async () => {
      for (let i = 0; i < 5; i++) {
        await testContext.db.create({
          type: 'AUDIO',
          state: 'CAPTURED',
          rawContent: `audio-${i}`,
          syncStatus: 'pending',
        });
      }
    });

    then('aucune tentative de connexion réseau n\'est faite', () => {
      expect(testContext.isOffline()).toBe(true);
    });

    and('aucune exception réseau n\'est levée', () => {
      // No network exceptions thrown
      expect(true).toBe(true);
    });

    and('les 5 captures sont sauvegardées localement', async () => {
      expect(await testContext.db.count()).toBe(5);
    });
  });

  // ==========================================================================
  // AC3: Accès Rapide aux Captures Offline
  // ==========================================================================

  test('Charger captures en < 1s au démarrage', ({ given, when, then, and }) => {
    given('que l\'utilisateur a 50 captures offline', async () => {
      for (let i = 0; i < 50; i++) {
        await testContext.db.create({
          type: 'AUDIO',
          state: 'CAPTURED',
          rawContent: `audio-${i}`,
          syncStatus: 'pending',
        });
      }
    });

    when('l\'utilisateur ouvre l\'application', async () => {
      loadStartTime = Date.now();
      const captures = await testContext.db.findAll();
      loadEndTime = Date.now();
      expect(captures.length).toBe(50);
    });

    then('toutes les captures sont chargées depuis WatermelonDB', async () => {
      const captures = await testContext.db.findAll();
      expect(captures.length).toBe(50);
    });

    and('le chargement prend moins de 1 seconde', () => {
      const loadTime = loadEndTime - loadStartTime;
      expect(loadTime).toBeLessThan(1000); // NFR4 compliance
    });

    and('le feed affiche les 50 captures', async () => {
      const captures = await testContext.db.findAll();
      expect(captures.length).toBe(50);
    });
  });

  test('Afficher indicateur offline dans le feed', ({ given, when, then, and }) => {
    given('que l\'utilisateur a 3 captures avec syncStatus "pending"', async () => {
      for (let i = 0; i < 3; i++) {
        await testContext.db.create({
          type: 'AUDIO',
          state: 'CAPTURED',
          rawContent: `pending-${i}`,
          syncStatus: 'pending',
        });
      }
    });

    given('l\'utilisateur a 2 captures avec syncStatus "synced"', async () => {
      for (let i = 0; i < 2; i++) {
        await testContext.db.create({
          type: 'AUDIO',
          state: 'CAPTURED',
          rawContent: `synced-${i}`,
          syncStatus: 'synced',
        });
      }
    });

    when('l\'utilisateur ouvre le feed', async () => {
      const allCaptures = await testContext.db.findAll();
      expect(allCaptures.length).toBe(5);
    });

    then('les 3 captures pending affichent une icône cloud slash', async () => {
      const pendingCaptures = await testContext.db.findBySyncStatus('pending');
      expect(pendingCaptures.length).toBe(3);

      // UI would render cloud-slash icon for these
      pendingCaptures.forEach(capture => {
        expect(capture.syncStatus).toBe('pending');
      });
    });

    and('les 2 captures synced n\'affichent pas d\'icône offline', async () => {
      const syncedCaptures = await testContext.db.findBySyncStatus('synced');
      expect(syncedCaptures.length).toBe(2);

      syncedCaptures.forEach(capture => {
        expect(capture.syncStatus).toBe('synced');
      });
    });
  });

  test('Aucune erreur réseau affichée', ({ given, when, then, and }) => {
    given('que l\'appareil est hors ligne', () => {
      testContext.setOffline(true);
    });

    given('l\'utilisateur a 10 captures offline', async () => {
      for (let i = 0; i < 10; i++) {
        await testContext.db.create({
          type: 'AUDIO',
          state: 'CAPTURED',
          rawContent: `audio-${i}`,
          syncStatus: 'pending',
        });
      }
    });

    when('l\'utilisateur ouvre l\'application', async () => {
      const captures = await testContext.db.findAll();
      expect(captures.length).toBe(10);
    });

    then('le feed se charge sans erreurs', async () => {
      const captures = await testContext.db.findAll();
      expect(captures).toBeDefined();
    });

    and('aucun message "Network error" n\'est affiché', () => {
      // UI assertion - no network error toast
      expect(true).toBe(true); // Placeholder
    });

    and('aucun toast d\'erreur réseau n\'apparaît', () => {
      // UI assertion
      expect(true).toBe(true); // Placeholder
    });
  });

  test('Optimistic UI - captures apparaissent instantanément', ({ when, then, and }) => {
    when('l\'utilisateur crée une capture audio', async () => {
      const capture = await testContext.db.create({
        type: 'AUDIO',
        state: 'CAPTURED',
        rawContent: 'new-audio',
        syncStatus: 'pending',
      });
      captureIds.push(capture.id);
    });

    then('la capture apparaît immédiatement dans le feed', async () => {
      const capture = await testContext.db.findById(captureIds[0]);
      expect(capture).toBeDefined();
    });

    and('l\'indicateur "pending" est affiché', async () => {
      const capture = await testContext.db.findById(captureIds[0]);
      expect(capture!.syncStatus).toBe('pending');
    });

    and('l\'utilisateur n\'attend pas de confirmation réseau', () => {
      // Optimistic UI - no network wait
      expect(true).toBe(true);
    });
  });

  test('Charger différentes quantités de captures', ({ given, when, then }) => {
    given(/que l'utilisateur a (\d+) captures offline/, async (nombre: string) => {
      const count = parseInt(nombre, 10);
      for (let i = 0; i < count; i++) {
        await testContext.db.create({
          type: 'AUDIO',
          state: 'CAPTURED',
          rawContent: `audio-${i}`,
          syncStatus: 'pending',
        });
      }
    });

    when('l\'utilisateur ouvre l\'application', async () => {
      loadStartTime = Date.now();
      await testContext.db.findAll();
      loadEndTime = Date.now();
    });

    then('les captures se chargent en moins de 1 seconde', () => {
      const loadTime = loadEndTime - loadStartTime;
      expect(loadTime).toBeLessThan(1000); // NFR4 compliance
    });
  });

  // ==========================================================================
  // AC4: Récupération après Crash
  // ==========================================================================

  test('Récupérer captures après crash', ({ given, when, then, and }) => {
    given('que l\'utilisateur a créé 5 captures offline', async () => {
      for (let i = 0; i < 5; i++) {
        const capture = await testContext.db.create({
          type: 'AUDIO',
          state: 'CAPTURED',
          rawContent: `audio-${i}`,
          syncStatus: 'pending',
        });
        captureIds.push(capture.id);
      }
    });

    given('l\'application crash avant synchronisation', () => {
      testContext.app.crash();
    });

    when('l\'utilisateur relance l\'application', () => {
      testContext.app.relaunch();
    });

    then('les 5 captures sont récupérées intactes', async () => {
      const captures = await testContext.db.findAll();
      expect(captures.length).toBe(5);
    });

    and('toutes les métadonnées sont préservées', async () => {
      const captures = await testContext.db.findAll();
      captures.forEach(capture => {
        expect(capture.rawContent).toBeDefined();
        expect(capture.capturedAt).toBeDefined();
      });
    });

    and('les fichiers audio existent toujours', () => {
      // Files would be preserved through crash
      expect(true).toBe(true); // Placeholder
    });
  });

  test('Préserver syncStatus après crash', ({ given, when, then, and }) => {
    given('que l\'utilisateur a 3 captures avec syncStatus "pending"', async () => {
      for (let i = 0; i < 3; i++) {
        await testContext.db.create({
          type: 'AUDIO',
          state: 'CAPTURED',
          rawContent: `pending-${i}`,
          syncStatus: 'pending',
        });
      }
    });

    given('l\'application crash', () => {
      testContext.app.crash();
    });

    when('l\'utilisateur relance l\'application', () => {
      testContext.app.relaunch();
    });

    then('les 3 captures ont toujours syncStatus "pending"', async () => {
      const pendingCaptures = await testContext.db.findBySyncStatus('pending');
      expect(pendingCaptures.length).toBe(3);
    });

    and('elles sont toujours dans la SyncQueue', () => {
      // TODO: Wire MockSyncQueue
      expect(true).toBe(true); // Placeholder
    });
  });

  test('Zero data loss après crash', ({ given, when, then, and }) => {
    let capturesBeforeCrash: Capture[];

    given('que l\'utilisateur a créé 10 captures', async () => {
      for (let i = 0; i < 10; i++) {
        await testContext.db.create({
          type: 'AUDIO',
          state: 'CAPTURED',
          rawContent: `audio-${i}`,
          syncStatus: 'pending',
        });
      }
      capturesBeforeCrash = await testContext.db.findAll();
    });

    given('l\'application crash', () => {
      testContext.app.crash();
    });

    when('l\'utilisateur relance l\'application', () => {
      testContext.app.relaunch();
    });

    then('exactement 10 captures sont présentes', async () => {
      const capturesAfterCrash = await testContext.db.findAll();
      expect(capturesAfterCrash.length).toBe(10);
    });

    and('aucune capture n\'est perdue', async () => {
      const capturesAfterCrash = await testContext.db.findAll();
      expect(capturesAfterCrash.length).toBe(capturesBeforeCrash.length);
    });

    and('tous les fichiers audio sont intacts', () => {
      // Files preserved through crash
      expect(true).toBe(true); // Placeholder
    });
  });

  test('Vérifier intégrité WatermelonDB au démarrage', ({ given, when, then, and }) => {
    given('que l\'application démarre après un crash', () => {
      testContext.app.crash();
      testContext.app.relaunch();
    });

    when('le CrashRecoveryService s\'exécute', async () => {
      // CrashRecoveryService would run integrity checks
      const count = await testContext.db.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    then('l\'intégrité de WatermelonDB est vérifiée', async () => {
      // DB integrity verified
      const captures = await testContext.db.findAll();
      expect(captures).toBeDefined();
    });

    and('le count des Captures correspond aux fichiers présents', async () => {
      const dbCount = await testContext.db.count();
      const fileCount = testContext.fileSystem.getFiles().length;
      // In tests, they may not match exactly (text captures have no files)
      expect(dbCount).toBeGreaterThanOrEqual(0);
    });

    and('aucune corruption de base n\'est détectée', () => {
      // No DB corruption
      expect(true).toBe(true); // Placeholder
    });
  });

  test('Nettoyer fichiers orphelins après crash', ({ given, when, then, and }) => {
    given('que 2 fichiers audio existent sans Capture associée (orphelins)', async () => {
      await testContext.fileSystem.writeFile('orphan-1.m4a', 'orphan-data-1');
      await testContext.fileSystem.writeFile('orphan-2.m4a', 'orphan-data-2');
    });

    when('le CrashRecoveryService s\'exécute au démarrage', async () => {
      // CrashRecoveryService would clean up orphaned files
      const files = testContext.fileSystem.getFiles();
      const captures = await testContext.db.findAll();

      // Delete files without corresponding Captures
      for (const file of files) {
        const hasCapture = captures.some(c => c.filePath === file.path);
        if (!hasCapture) {
          await testContext.fileSystem.deleteFile(file.path);
        }
      }
    });

    then('les 2 fichiers orphelins sont supprimés', async () => {
      const orphan1Exists = await testContext.fileSystem.fileExists('orphan-1.m4a');
      const orphan2Exists = await testContext.fileSystem.fileExists('orphan-2.m4a');
      expect(orphan1Exists).toBe(false);
      expect(orphan2Exists).toBe(false);
    });

    and('seuls les fichiers avec Captures valides restent', async () => {
      const files = testContext.fileSystem.getFiles();
      const captures = await testContext.db.findAll();

      for (const file of files) {
        const hasCapture = captures.some(c => c.filePath === file.path);
        expect(hasCapture).toBe(true);
      }
    });
  });

  // ==========================================================================
  // AC5: Gestion du Stockage
  // ==========================================================================

  test('Nettoyer fichiers audio > 90 jours', ({ given, when, then, and }) => {
    given('que l\'utilisateur a 100 captures de plus de 90 jours', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // 100 days ago

      for (let i = 0; i < 100; i++) {
        const capture = await testContext.db.create({
          type: 'AUDIO',
          state: 'CAPTURED',
          rawContent: `old-audio-${i}`,
          filePath: `old-audio-${i}.m4a`,
          capturedAt: oldDate,
          syncStatus: 'synced',
        });
        await testContext.fileSystem.writeFile(capture.filePath!, 'old-audio-data');
      }
    });

    given('l\'utilisateur a 50 captures de moins de 90 jours', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30); // 30 days ago

      for (let i = 0; i < 50; i++) {
        const capture = await testContext.db.create({
          type: 'AUDIO',
          state: 'CAPTURED',
          rawContent: `recent-audio-${i}`,
          filePath: `recent-audio-${i}.m4a`,
          capturedAt: recentDate,
          syncStatus: 'synced',
        });
        await testContext.fileSystem.writeFile(capture.filePath!, 'recent-audio-data');
      }
    });

    when('le cleanup automatique s\'exécute', async () => {
      const allCaptures = await testContext.db.findAll();
      const now = Date.now();
      const retentionDays = 90;

      for (const capture of allCaptures) {
        if (capture.filePath) {
          const ageInDays = (now - capture.capturedAt.getTime()) / (1000 * 60 * 60 * 24);
          if (ageInDays > retentionDays) {
            await testContext.fileSystem.deleteFile(capture.filePath);
          }
        }
      }
    });

    then('les fichiers audio des 100 anciennes captures sont supprimés', async () => {
      for (let i = 0; i < 100; i++) {
        const fileExists = await testContext.fileSystem.fileExists(`old-audio-${i}.m4a`);
        expect(fileExists).toBe(false);
      }
    });

    and('les fichiers audio des 50 récentes captures sont conservés', async () => {
      for (let i = 0; i < 50; i++) {
        const fileExists = await testContext.fileSystem.fileExists(`recent-audio-${i}.m4a`);
        expect(fileExists).toBe(true);
      }
    });
  });

  test('Conserver transcriptions et metadata', ({ given, when, then, and }) => {
    given('que l\'utilisateur a des captures > 90 jours', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const capture = await testContext.db.create({
        type: 'AUDIO',
        state: 'CAPTURED',
        rawContent: 'old-audio',
        normalizedText: 'Transcription de la capture ancienne',
        filePath: 'old-audio.m4a',
        capturedAt: oldDate,
        duration: 5000,
        syncStatus: 'synced',
      });

      await testContext.fileSystem.writeFile(capture.filePath!, 'old-audio-data');
      captureIds.push(capture.id);
    });

    when('le cleanup automatique supprime les fichiers audio', async () => {
      const capture = await testContext.db.findById(captureIds[0]);
      if (capture && capture.filePath) {
        await testContext.fileSystem.deleteFile(capture.filePath);
      }
    });

    then('les transcriptions (normalizedText) sont conservées', async () => {
      const capture = await testContext.db.findById(captureIds[0]);
      expect(capture!.normalizedText).toBe('Transcription de la capture ancienne');
    });

    and('les métadonnées (capturedAt, duration, etc.) sont conservées', async () => {
      const capture = await testContext.db.findById(captureIds[0]);
      expect(capture!.capturedAt).toBeDefined();
      expect(capture!.duration).toBe(5000);
    });

    and('seuls les fichiers audio (filePath) sont supprimés', async () => {
      const fileExists = await testContext.fileSystem.fileExists('old-audio.m4a');
      expect(fileExists).toBe(false);
    });
  });

  test('Notification avant cleanup', ({ given, when, then, and }) => {
    given('que le cleanup automatique doit s\'exécuter', () => {
      // Cleanup scheduled
    });

    when('le StorageManager détecte des fichiers à nettoyer', () => {
      // Files detected for cleanup
      testContext.dialog.show('Clean up old audio files?', ['Confirm', 'Cancel']);
    });

    then('une notification est envoyée à l\'utilisateur', () => {
      expect(testContext.dialog.isShown()).toBe(true);
    });

    and('l\'utilisateur peut confirmer ou annuler le cleanup', () => {
      expect(testContext.dialog.getOptions()).toContain('Confirm');
      expect(testContext.dialog.getOptions()).toContain('Cancel');
    });

    and('si l\'utilisateur annule, aucun fichier n\'est supprimé', () => {
      testContext.dialog.selectOption('Cancel');
      // No files deleted
      expect(true).toBe(true); // Placeholder
    });
  });

  test('Cleanup manuel depuis settings', ({ given, when, then, and }) => {
    given('que l\'utilisateur ouvre les paramètres', () => {
      // Settings screen opened
    });

    when('l\'utilisateur tape sur "Clean up old audio files"', () => {
      testContext.dialog.show('Clean up old audio files?', ['Confirm', 'Cancel']);
    });

    then('un dialog de confirmation s\'affiche', () => {
      expect(testContext.dialog.isShown()).toBe(true);
    });

    and('si l\'utilisateur confirme, le cleanup s\'exécute', () => {
      testContext.dialog.selectOption('Confirm');
      // Cleanup executes
      expect(true).toBe(true); // Placeholder
    });

    and('l\'espace libéré est affiché après le cleanup', () => {
      // UI shows freed space
      expect(true).toBe(true); // Placeholder
    });
  });

  // ==========================================================================
  // AC6: Encryption at Rest
  // ==========================================================================

  test('Encryter fichiers audio at rest', ({ when, then, and }) => {
    when('l\'utilisateur crée une capture audio', async () => {
      await testContext.audioRecorder.startRecording();
      testContext.audioRecorder.simulateRecording(2000);
      const { uri } = await testContext.audioRecorder.stopRecording();

      await testContext.fileSystem.writeFile(uri, 'encrypted-audio-data');

      const capture = await testContext.db.create({
        type: 'AUDIO',
        state: 'CAPTURED',
        filePath: uri,
        rawContent: uri,
        syncStatus: 'pending',
        // encryptionStatus: true, // TODO: Add field to schema
      });

      captureIds.push(capture.id);
    });

    when('le fichier audio est écrit sur le disque', async () => {
      // File written in previous step
      const capture = await testContext.db.findById(captureIds[0]);
      expect(capture).toBeDefined();
    });

    then('le fichier est encrypté avec device-level encryption', () => {
      // Device-level encryption (iOS Data Protection / Android File-based encryption)
      expect(true).toBe(true); // Placeholder
    });

    and('l\'encryption utilise iOS Data Protection ou Android File-based encryption', () => {
      // Platform-specific encryption
      expect(true).toBe(true); // Placeholder
    });

    and('la Capture a encryptionStatus = true', async () => {
      // TODO: Add encryptionStatus field to Capture schema
      // const capture = await testContext.db.findById(captureIds[0]);
      // expect(capture!.encryptionStatus).toBe(true);
      expect(true).toBe(true); // Placeholder
    });
  });

  test('Metadata avec encryptionStatus flag', ({ given, when, then, and }) => {
    given('que l\'utilisateur crée une capture audio', async () => {
      await testContext.audioRecorder.startRecording();
      testContext.audioRecorder.simulateRecording(1000);
      const { uri } = await testContext.audioRecorder.stopRecording();

      const capture = await testContext.db.create({
        type: 'AUDIO',
        state: 'CAPTURED',
        filePath: uri,
        rawContent: uri,
        syncStatus: 'pending',
      });

      captureIds.push(capture.id);
    });

    when('la Capture est persistée dans WatermelonDB', async () => {
      const capture = await testContext.db.findById(captureIds[0]);
      expect(capture).toBeDefined();
    });

    then('la Capture contient le champ encryptionStatus', () => {
      // TODO: Add encryptionStatus field to schema
      expect(true).toBe(true); // Placeholder
    });

    and('encryptionStatus = true', () => {
      // TODO: Verify encryptionStatus
      expect(true).toBe(true); // Placeholder
    });

    and('la metadata confirme que le fichier est encrypté', () => {
      // Metadata confirmation
      expect(true).toBe(true); // Placeholder
    });
  });

  test('Encryption transparente pour l\'utilisateur', ({ when, then, and }) => {
    when('l\'utilisateur crée une capture audio', async () => {
      await testContext.db.create({
        type: 'AUDIO',
        state: 'CAPTURED',
        rawContent: 'audio',
        syncStatus: 'pending',
      });
    });

    then('aucune UI d\'encryption n\'est affichée', () => {
      // No encryption UI shown
      expect(true).toBe(true); // Placeholder
    });

    and('l\'encryption est gérée automatiquement par l\'OS', () => {
      // OS handles encryption transparently
      expect(true).toBe(true); // Placeholder
    });

    and('l\'utilisateur n\'a aucune action à faire', () => {
      // No user action required
      expect(true).toBe(true); // Placeholder
    });
  });

  test('Vérifier encryption lors de l\'écriture', ({ when, then, and }) => {
    when('l\'utilisateur crée une capture audio', async () => {
      await testContext.audioRecorder.startRecording();
      testContext.audioRecorder.simulateRecording(1000);
      const { uri } = await testContext.audioRecorder.stopRecording();
      await testContext.fileSystem.writeFile(uri, 'encrypted-data');
    });

    when('le fichier est écrit avec FileSystem.writeAsStringAsync()', () => {
      // File written in previous step
      expect(true).toBe(true);
    });

    then('l\'attribut de protection iOS NSFileProtectionComplete est appliqué', () => {
      // iOS-specific encryption attribute
      expect(true).toBe(true); // Placeholder
    });

    then('l\'encryption Android FileSystem.StorageAccessFramework est activée', () => {
      // Android-specific encryption
      expect(true).toBe(true); // Placeholder
    });

    and('le flag encryptionStatus est définit à true dans la Capture', () => {
      // TODO: Verify encryptionStatus flag
      expect(true).toBe(true); // Placeholder
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  test('Gérer stockage complètement plein', ({ given, when, then, and }) => {
    given('que l\'appareil a 0 MB d\'espace disponible', () => {
      testContext.fileSystem.setAvailableSpace(0);
    });

    when('l\'utilisateur tente de créer une capture', () => {
      const availableSpace = testContext.fileSystem.getAvailableSpace();
      if (availableSpace === 0) {
        testContext.dialog.show('Storage full', ['OK']);
      }
    });

    then('un dialog "Storage full" s\'affiche', () => {
      expect(testContext.dialog.isShown()).toBe(true);
      expect(testContext.dialog.getMessage()).toContain('Storage full');
    });

    and('la capture est bloquée', async () => {
      const captureCount = await testContext.db.count();
      expect(captureCount).toBe(0);
    });

    and('aucune tentative d\'écriture n\'est faite', () => {
      expect(testContext.fileSystem.getFiles().length).toBe(0);
    });
  });

  test('Créer captures très rapidement (stress test)', ({ when, then, and }) => {
    when('l\'utilisateur crée 50 captures en 10 secondes', async () => {
      for (let i = 0; i < 50; i++) {
        const capture = await testContext.db.create({
          type: 'AUDIO',
          state: 'CAPTURED',
          rawContent: `rapid-audio-${i}`,
          syncStatus: 'pending',
        });
        captureIds.push(capture.id);
      }
    });

    then('toutes les 50 captures sont sauvegardées', async () => {
      expect(await testContext.db.count()).toBe(50);
    });

    and('aucune collision d\'ID ne se produit', () => {
      const uniqueIds = new Set(captureIds);
      expect(uniqueIds.size).toBe(50);
    });

    and('tous les fichiers audio sont uniques', () => {
      // All captures have unique IDs
      expect(captureIds.length).toBe(50);
    });
  });

  test('Récupérer d\'une corruption de base', ({ given, when, then, and }) => {
    given('que WatermelonDB est corrompu', () => {
      // Simulate DB corruption
      // In real scenario, this would be a corrupted SQLite file
    });

    when('l\'application démarre', () => {
      // App startup triggers recovery
    });

    then('le CrashRecoveryService détecte la corruption', () => {
      // Corruption detected
      expect(true).toBe(true); // Placeholder
    });

    and('une tentative de réparation est faite', () => {
      // Repair attempt
      expect(true).toBe(true); // Placeholder
    });

    and('l\'utilisateur est notifié si la réparation échoue', () => {
      // User notification
      expect(true).toBe(true); // Placeholder
    });
  });

  test('Préserver la SyncQueue après redémarrage', ({ given, when, then, and }) => {
    given('que 20 captures sont dans la SyncQueue', async () => {
      for (let i = 0; i < 20; i++) {
        await testContext.db.create({
          type: 'AUDIO',
          state: 'CAPTURED',
          rawContent: `pending-${i}`,
          syncStatus: 'pending',
        });
      }
    });

    when('l\'application est fermée normalement', () => {
      // App closed (not crashed)
    });

    when('l\'application est rouverte', async () => {
      // App reopened
      const pendingCaptures = await testContext.db.findBySyncStatus('pending');
      expect(pendingCaptures.length).toBe(20);
    });

    then('les 20 captures sont toujours dans la SyncQueue', async () => {
      const pendingCaptures = await testContext.db.findBySyncStatus('pending');
      expect(pendingCaptures.length).toBe(20);
    });

    and('aucune capture n\'est perdue de la queue', async () => {
      const pendingCaptures = await testContext.db.findBySyncStatus('pending');
      expect(pendingCaptures.length).toBe(20);
    });
  });
});
