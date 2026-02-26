/**
 * BDD Acceptance Tests for Story 7.2: Logs DevTools — Rotation FIFO (limite 100 entrées)
 *
 * Test Strategy:
 * - Uses jest-cucumber for BDD with Gherkin
 * - Tests opèrent directement sur le store Zustand (pas de mocks complexes)
 * - Le store est réinitialisé avant chaque scénario via setState
 *
 * Coverage:
 * - AC1: Limite maximale à 100 entrées (Scenario 1)
 * - AC2: Comportement sous le seuil — pas de suppression (Scenario 2)
 * - AC3: Rotation transparente et automatique (Scenario 3)
 * - AC5: Conservation des logs les plus récents (Scenario 3)
 * - AC4: Non-régression clearLogs (Scenario 4)
 *
 * Run: npm run test:acceptance -- --testPathPattern="story-7-2"
 */

import { defineFeature, loadFeature } from 'jest-cucumber';
import { LogEntry, MAX_LOGS, useLogsDebugStore } from '../../src/components/dev/stores/logsDebugStore';

const feature = loadFeature('tests/acceptance/features/story-7-2.feature');

// Helper pour créer une entrée de log
function makeEntry(message: string): LogEntry {
  return { timestamp: new Date(), level: 'log', message };
}

// Helper pour remplir le store jusqu'à une limite donnée
function fillStore(count: number): void {
  for (let i = 0; i < count; i++) {
    useLogsDebugStore.getState().addLog(makeEntry(`entry-${i}`));
  }
}

defineFeature(feature, (test) => {
  test('Rotation FIFO — insertion de la 101ème entrée', ({ given, when, then, and }) => {
    given('le store de logs est réinitialisé', () => {
      useLogsDebugStore.setState({ logs: [] });
    });

    given('le store de logs contient exactement 100 entrées', () => {
      useLogsDebugStore.setState({ logs: [] });
      fillStore(MAX_LOGS);
      expect(useLogsDebugStore.getState().logs).toHaveLength(MAX_LOGS);
    });

    when('une nouvelle entrée est ajoutée via addLog', () => {
      useLogsDebugStore.getState().addLog(makeEntry('new-entry'));
    });

    then('le store contient toujours exactement 100 entrées', () => {
      expect(useLogsDebugStore.getState().logs).toHaveLength(MAX_LOGS);
    });

    and('la nouvelle entrée est la dernière dans le tableau', () => {
      const { logs } = useLogsDebugStore.getState();
      expect(logs[logs.length - 1].message).toBe('new-entry');
    });

    and("l'entrée la plus ancienne a été supprimée", () => {
      const { logs } = useLogsDebugStore.getState();
      // entry-0 doit avoir été supprimée, entry-1 est maintenant le premier
      expect(logs[0].message).toBe('entry-1');
    });
  });

  test('Buffer sous seuil — pas de suppression', ({ given, when, then, and }) => {
    given('le store de logs est réinitialisé', () => {
      useLogsDebugStore.setState({ logs: [] });
    });

    given('le store de logs contient 50 entrées', () => {
      fillStore(50);
      expect(useLogsDebugStore.getState().logs).toHaveLength(50);
    });

    when('une nouvelle entrée est ajoutée via addLog', () => {
      useLogsDebugStore.getState().addLog(makeEntry('entry-50'));
    });

    then('le store contient 51 entrées', () => {
      expect(useLogsDebugStore.getState().logs).toHaveLength(51);
    });

    and('toutes les entrées précédentes sont préservées', () => {
      const { logs } = useLogsDebugStore.getState();
      // Toutes les entrées originales (entry-0 à entry-49) sont présentes
      expect(logs[0].message).toBe('entry-0');
      expect(logs[49].message).toBe('entry-49');
      expect(logs[50].message).toBe('entry-50');
    });
  });

  test('Préservation des logs les plus récents', ({ given, when, then, and }) => {
    given('le store de logs est réinitialisé', () => {
      useLogsDebugStore.setState({ logs: [] });
    });

    given('le store de logs est vide', () => {
      useLogsDebugStore.setState({ logs: [] });
      expect(useLogsDebugStore.getState().logs).toHaveLength(0);
    });

    when('200 entrées sont ajoutées consécutivement via addLog', () => {
      for (let i = 0; i < 200; i++) {
        useLogsDebugStore.getState().addLog(makeEntry(`log-${i}`));
      }
    });

    then('le store contient exactement 100 entrées', () => {
      expect(useLogsDebugStore.getState().logs).toHaveLength(MAX_LOGS);
    });

    and('les entrées conservées sont les 100 dernières insérées', () => {
      const { logs } = useLogsDebugStore.getState();
      // Les 100 derniers : log-100 à log-199
      expect(logs[0].message).toBe('log-100');
      expect(logs[99].message).toBe('log-199');
    });
  });

  test('Non-régression clearLogs après rotation', ({ given, when, then, and }) => {
    given('le store de logs est réinitialisé', () => {
      useLogsDebugStore.setState({ logs: [] });
    });

    given('le store de logs contient exactement 100 entrées', () => {
      fillStore(MAX_LOGS);
      expect(useLogsDebugStore.getState().logs).toHaveLength(MAX_LOGS);
    });

    when('clearLogs est appelé', () => {
      useLogsDebugStore.getState().clearLogs();
    });

    then('le store est complètement vide', () => {
      expect(useLogsDebugStore.getState().logs).toHaveLength(0);
    });

    and('de nouvelles entrées peuvent être ajoutées normalement', () => {
      useLogsDebugStore.getState().addLog(makeEntry('post-clear'));
      const { logs } = useLogsDebugStore.getState();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('post-clear');
    });
  });
});
