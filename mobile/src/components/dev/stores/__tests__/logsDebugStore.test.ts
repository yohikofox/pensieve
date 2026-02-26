/**
 * Tests unitaires — logsDebugStore
 * Story 7.2 : Logs DevTools — Rotation FIFO (limite 100 entrées)
 */

import { act } from '@testing-library/react-native';
import { LogEntry, MAX_LOGS, useLogsDebugStore } from '../logsDebugStore';

// Helper pour créer une entrée de log
function makeEntry(message: string): LogEntry {
  return { timestamp: new Date(), level: 'log', message };
}

// Reset le store entre chaque test
beforeEach(() => {
  act(() => {
    useLogsDebugStore.getState().clearLogs();
  });
});

describe('logsDebugStore — Rotation FIFO', () => {
  describe('MAX_LOGS constant', () => {
    it('doit exporter MAX_LOGS égal à 100', () => {
      expect(MAX_LOGS).toBe(100);
    });
  });

  describe('AC2 : Comportement sous le seuil (< 100 entrées)', () => {
    it('addLog sous le seuil ajoute sans supprimer', () => {
      useLogsDebugStore.setState({ logs: [] });

      act(() => {
        for (let i = 0; i < 5; i++) {
          useLogsDebugStore.getState().addLog(makeEntry(`log-${i}`));
        }
      });

      expect(useLogsDebugStore.getState().logs).toHaveLength(5);
    });

    it('addLog 5 entrées produit exactement 5 entrées', () => {
      // Partir d'un état vide garanti
      useLogsDebugStore.setState({ logs: [] });

      act(() => {
        for (let i = 0; i < 5; i++) {
          useLogsDebugStore.getState().addLog(makeEntry(`msg-${i}`));
        }
      });

      expect(useLogsDebugStore.getState().logs).toHaveLength(5);
    });

    it('toutes les entrées précédentes sont préservées sous le seuil', () => {
      useLogsDebugStore.setState({ logs: [] });

      act(() => {
        for (let i = 0; i < 10; i++) {
          useLogsDebugStore.getState().addLog(makeEntry(`item-${i}`));
        }
      });

      const { logs } = useLogsDebugStore.getState();
      expect(logs).toHaveLength(10);
      expect(logs[0].message).toBe('item-0');
      expect(logs[9].message).toBe('item-9');
    });
  });

  describe('AC1 : Limite maximale à 100 entrées', () => {
    it('addLog à exactement 100 → 100 entrées (pas de suppression prématurée)', () => {
      useLogsDebugStore.setState({ logs: [] });

      act(() => {
        for (let i = 0; i < 100; i++) {
          useLogsDebugStore.getState().addLog(makeEntry(`entry-${i}`));
        }
      });

      expect(useLogsDebugStore.getState().logs).toHaveLength(100);
    });

    it('addLog la 101ème entrée maintient exactement 100 entrées', () => {
      useLogsDebugStore.setState({ logs: [] });

      act(() => {
        for (let i = 0; i < 101; i++) {
          useLogsDebugStore.getState().addLog(makeEntry(`entry-${i}`));
        }
      });

      expect(useLogsDebugStore.getState().logs).toHaveLength(100);
    });

    it("l'entrée la plus ancienne (index 0) est supprimée lors du dépassement", () => {
      useLogsDebugStore.setState({ logs: [] });

      act(() => {
        for (let i = 0; i < 100; i++) {
          useLogsDebugStore.getState().addLog(makeEntry(`entry-${i}`));
        }
      });

      // À ce stade logs[0].message === 'entry-0'
      act(() => {
        useLogsDebugStore.getState().addLog(makeEntry('entry-100'));
      });

      const { logs } = useLogsDebugStore.getState();
      expect(logs[0].message).toBe('entry-1'); // entry-0 supprimé
      expect(logs[99].message).toBe('entry-100'); // nouvelle entrée en dernier
    });
  });

  describe('AC5 : Conservation des logs les plus récents', () => {
    it('après 200 insertions → exactement 100 entrées conservées', () => {
      useLogsDebugStore.setState({ logs: [] });

      act(() => {
        for (let i = 0; i < 200; i++) {
          useLogsDebugStore.getState().addLog(makeEntry(`log-${i}`));
        }
      });

      expect(useLogsDebugStore.getState().logs).toHaveLength(100);
    });

    it('les 100 entrées conservées sont les plus récentes (FIFO sémantique)', () => {
      useLogsDebugStore.setState({ logs: [] });

      act(() => {
        for (let i = 0; i < 200; i++) {
          useLogsDebugStore.getState().addLog(makeEntry(`log-${i}`));
        }
      });

      const { logs } = useLogsDebugStore.getState();
      // Les 100 derniers : log-100 à log-199
      expect(logs[0].message).toBe('log-100');
      expect(logs[99].message).toBe('log-199');
    });
  });

  describe('AC3 : Rotation transparente et automatique', () => {
    it('la rotation ne nécessite aucune action utilisateur', () => {
      useLogsDebugStore.setState({ logs: [] });

      // Insérer en continu sans appel explicite de rotation
      act(() => {
        for (let i = 0; i < 150; i++) {
          useLogsDebugStore.getState().addLog(makeEntry(`auto-${i}`));
        }
      });

      // La limite est respectée automatiquement
      expect(useLogsDebugStore.getState().logs.length).toBeLessThanOrEqual(MAX_LOGS);
    });
  });

  describe('AC4 : Non-régression fonctionnalités existantes', () => {
    it('clearLogs vide complètement le store (sans affecter la limite)', () => {
      useLogsDebugStore.setState({ logs: [] });

      act(() => {
        for (let i = 0; i < 50; i++) {
          useLogsDebugStore.getState().addLog(makeEntry(`entry-${i}`));
        }
        useLogsDebugStore.getState().clearLogs();
      });

      expect(useLogsDebugStore.getState().logs).toHaveLength(0);
    });

    it('après clearLogs, les nouvelles entrées sont acceptées normalement', () => {
      useLogsDebugStore.setState({ logs: [] });

      act(() => {
        for (let i = 0; i < 50; i++) {
          useLogsDebugStore.getState().addLog(makeEntry(`before-${i}`));
        }
        useLogsDebugStore.getState().clearLogs();
        useLogsDebugStore.getState().addLog(makeEntry('after-clear'));
      });

      const { logs } = useLogsDebugStore.getState();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('after-clear');
    });

    it('setSniffing non affecté par la limite de logs', () => {
      act(() => {
        useLogsDebugStore.getState().setSniffing(false);
      });
      expect(useLogsDebugStore.getState().sniffing).toBe(false);

      act(() => {
        useLogsDebugStore.getState().setSniffing(true);
      });
      expect(useLogsDebugStore.getState().sniffing).toBe(true);
    });
  });
});
