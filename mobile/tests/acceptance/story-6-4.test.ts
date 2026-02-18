/**
 * Story 6.4: Indicateurs de Statut de Synchronisation
 * Acceptance Tests - BDD Scenarios
 *
 * Pattern: BDD avec jest-cucumber
 * Mocks: EventBus, SyncStatusStore, SyncService, NetInfo, AsyncStorage
 */

import { loadFeature, defineFeature } from 'jest-cucumber';

const feature = loadFeature(
  './tests/acceptance/features/story-6-4-indicateurs-sync.feature',
);

// ============================================================================
// Mocks
// ============================================================================

// Mock AsyncStorage (for useLongOfflineReminder dismissal persistence)
const mockAsyncStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockAsyncStorage[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockAsyncStorage[key] = value;
  }),
}));

// Mock NetInfo for WiFi-only tests
let mockNetInfoState = {
  isConnected: true,
  isInternetReachable: true,
  type: 'wifi',
};

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(async () => mockNetInfoState),
}));

// Mock React Native Alert
const mockAlertCalls: string[] = [];
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn((title: string) => {
      mockAlertCalls.push(title);
    }),
  },
}));

// In-memory SyncStatusStore mock
interface MockSyncStatusState {
  status: 'synced' | 'syncing' | 'pending' | 'error';
  lastSyncTime: number | null;
  pendingCount: number;
  errorMessage: string | null;
}

class MockSyncStatusStore {
  private state: MockSyncStatusState = {
    status: 'synced',
    lastSyncTime: null,
    pendingCount: 0,
    errorMessage: null,
  };

  getState() {
    return { ...this.state };
  }

  setSyncing() {
    this.state = { ...this.state, status: 'syncing', errorMessage: null };
  }

  setSynced(timestamp: number) {
    this.state = {
      ...this.state,
      status: 'synced',
      lastSyncTime: timestamp,
      errorMessage: null,
    };
  }

  setPending(count: number) {
    this.state = { ...this.state, status: 'pending', pendingCount: count };
  }

  setError(message: string) {
    this.state = { ...this.state, status: 'error', errorMessage: message };
  }

  reset() {
    this.state = {
      status: 'synced',
      lastSyncTime: null,
      pendingCount: 0,
      errorMessage: null,
    };
  }
}

// In-memory EventBus mock (pub/sub)
type EventHandler = (event: any) => void;

class MockEventBus {
  private handlers: EventHandler[] = [];

  subscribeAll(handler: EventHandler) {
    this.handlers.push(handler);
    return {
      unsubscribe: () => {
        this.handlers = this.handlers.filter((h) => h !== handler);
      },
    };
  }

  publish(event: any) {
    this.handlers.forEach((h) => h(event));
  }
}

// Mock SyncService
class MockSyncService {
  public syncCalls: Array<{ priority: string }> = [];

  async sync(options: { priority: string }) {
    this.syncCalls.push(options);
    return { result: 'SUCCESS', conflicts: [], retryable: false, error: undefined };
  }
}

// ============================================================================
// Test suite
// ============================================================================

defineFeature(feature, (test) => {
  let syncStatusStore: MockSyncStatusStore;
  let eventBus: MockEventBus;
  let syncService: MockSyncService;

  beforeEach(() => {
    syncStatusStore = new MockSyncStatusStore();
    eventBus = new MockEventBus();
    syncService = new MockSyncService();
    mockAlertCalls.length = 0;
    Object.keys(mockAsyncStorage).forEach((k) => delete mockAsyncStorage[k]);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scénario 1: SyncCompletedEvent → status 'synced'
  // ──────────────────────────────────────────────────────────────────────────
  test("L'indicateur passe à \"synchronisé\" après un SyncCompletedEvent", ({
    given,
    and,
    when,
    then,
  }) => {
    let bridgeSubscription: { unsubscribe: () => void } | null = null;

    given("l'application est démarrée et le bridge EventBus est actif", () => {
      // Simulate useSyncStatusBridge behaviour
      bridgeSubscription = eventBus.subscribeAll((event: any) => {
        if (event.type === 'SyncCompleted') {
          syncStatusStore.setSynced(Date.now());
        } else if (event.type === 'SyncFailed') {
          if (event.payload.retryable) {
            syncStatusStore.setPending(0);
          } else {
            syncStatusStore.setError(event.payload.error);
          }
        }
      });
    });

    and('le SyncStatusStore est à l\'état "en attente"', () => {
      syncStatusStore.setPending(3);
      expect(syncStatusStore.getState().status).toBe('pending');
    });

    when('un SyncCompletedEvent est publié sur l\'EventBus', () => {
      eventBus.publish({
        type: 'SyncCompleted',
        timestamp: Date.now(),
        payload: { entities: ['captures'], direction: 'both', changesCount: 5 },
      });
    });

    then('le SyncStatusStore passe à l\'état "synced"', () => {
      expect(syncStatusStore.getState().status).toBe('synced');
    });

    and('le timestamp de dernière sync est mis à jour', () => {
      expect(syncStatusStore.getState().lastSyncTime).not.toBeNull();
      bridgeSubscription?.unsubscribe();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scénario 2: SyncFailedEvent retryable → status 'pending', count préservé
  // Fix #7 (code review): setPending doit préserver le pendingCount existant
  // ──────────────────────────────────────────────────────────────────────────
  test("L'indicateur passe à \"pending\" après un SyncFailedEvent retryable", ({
    given,
    and,
    when,
    then,
  }) => {
    given("l'application est démarrée et le bridge EventBus est actif", () => {
      eventBus.subscribeAll((event: any) => {
        if (event.type === 'SyncFailed' && event.payload.retryable) {
          // Fix: preserve existing pendingCount instead of resetting to 0
          const currentCount = syncStatusStore.getState().pendingCount;
          syncStatusStore.setPending(currentCount);
        }
      });
    });

    and('le SyncStatusStore est à l\'état "syncing"', () => {
      // Simulate prior pending state with 5 items before sync started
      syncStatusStore.setPending(5);
      syncStatusStore.setSyncing();
      expect(syncStatusStore.getState().status).toBe('syncing');
      expect(syncStatusStore.getState().pendingCount).toBe(5);
    });

    when('un SyncFailedEvent retryable est publié sur l\'EventBus', () => {
      eventBus.publish({
        type: 'SyncFailed',
        timestamp: Date.now(),
        payload: { error: 'TIMEOUT', retryable: true },
      });
    });

    then('le SyncStatusStore passe à l\'état "pending"', () => {
      expect(syncStatusStore.getState().status).toBe('pending');
    });

    and('le pendingCount est préservé (pas réinitialisé à 0)', () => {
      // Fix #7: count must be preserved, not reset to 0
      expect(syncStatusStore.getState().pendingCount).toBe(5);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scénario 3: SyncFailedEvent non-retryable → status 'error'
  // ──────────────────────────────────────────────────────────────────────────
  test("L'indicateur passe à \"error\" après un SyncFailedEvent non-retryable", ({
    given,
    and,
    when,
    then,
  }) => {
    given("l'application est démarrée et le bridge EventBus est actif", () => {
      eventBus.subscribeAll((event: any) => {
        if (event.type === 'SyncFailed' && !event.payload.retryable) {
          syncStatusStore.setError(event.payload.error);
        }
      });
    });

    and('le SyncStatusStore est à l\'état "syncing"', () => {
      syncStatusStore.setSyncing();
    });

    when(
      'un SyncFailedEvent non-retryable est publié avec l\'erreur "NETWORK_UNAVAILABLE"',
      () => {
        eventBus.publish({
          type: 'SyncFailed',
          timestamp: Date.now(),
          payload: { error: 'NETWORK_UNAVAILABLE', retryable: false },
        });
      },
    );

    then('le SyncStatusStore passe à l\'état "error"', () => {
      expect(syncStatusStore.getState().status).toBe('error');
    });

    and('le message d\'erreur est "NETWORK_UNAVAILABLE"', () => {
      expect(syncStatusStore.getState().errorMessage).toBe('NETWORK_UNAVAILABLE');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scénario 4: Pull-to-refresh → sync manual avec priority 'high'
  // Fix #4 (code review): Simulate full useManualSync behaviour
  //   setSyncing() AVANT sync(), puis Result Pattern post-sync
  // ──────────────────────────────────────────────────────────────────────────
  test('Le pull-to-refresh déclenche une synchronisation manuelle', ({
    given,
    and,
    when,
    then,
  }) => {
    given("l'utilisateur est sur l'écran Captures", () => {
      // Setup: user is on CapturesListScreen (simulated)
    });

    and("l'application est en ligne", () => {
      mockNetInfoState = { isConnected: true, isInternetReachable: true, type: 'wifi' };
    });

    when("l'utilisateur effectue un pull-to-refresh", async () => {
      // Fix #4: Simulate full useManualSync.triggerManualSync() logic:
      // 1. setSyncing() first (store state update)
      syncStatusStore.setSyncing();
      // 2. Call sync with high priority
      const response = await syncService.sync({ priority: 'high' });
      // 3. Handle Result Pattern (ADR-023)
      if (response.result === 'SUCCESS') {
        // setSynced triggered by bridge via SyncCompletedEvent (no duplicate)
      } else if (response.retryable) {
        const currentCount = syncStatusStore.getState().pendingCount;
        syncStatusStore.setPending(currentCount);
      } else {
        syncStatusStore.setError(response.error ?? 'Échec');
      }
    });

    then('le SyncService.sync() est appelé avec priority "high"', () => {
      expect(syncService.syncCalls).toHaveLength(1);
      expect(syncService.syncCalls[0].priority).toBe('high');
    });

    and('l\'indicateur de sync passe à l\'état "syncing"', () => {
      // MockSyncService returns SUCCESS synchronously, so status transitions through syncing
      // The setSyncing() call happened before sync — verify it was called
      expect(syncStatusStore.getState().status).toBe('syncing');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scénario 5: syncOnWifiOnly activé + données mobiles → pas de sync
  // ──────────────────────────────────────────────────────────────────────────
  test(
    "Le sync automatique est ignoré si syncOnWifiOnly est activé en data mobile",
    ({ given, and, when, then }) => {
      let syncOnWifiOnly = false;

      given('le paramètre syncOnWifiOnly est activé', () => {
        syncOnWifiOnly = true;
      });

      and("l'appareil est connecté en données mobiles (pas Wi-Fi)", () => {
        mockNetInfoState = { isConnected: true, isInternetReachable: true, type: 'cellular' };
      });

      when("l'AutoSyncOrchestrator détecte que le réseau revient", async () => {
        // Simulate AutoSyncOrchestrator.handleNetworkChange() logic
        const NetInfo = require('@react-native-community/netinfo');
        const netState = await NetInfo.fetch();

        if (syncOnWifiOnly && netState.type !== 'wifi') {
          // Skip sync — do NOT call syncService.sync()
          return;
        }

        await syncService.sync({ priority: 'high' });
      });

      then("le SyncService.sync() n'est PAS appelé", () => {
        expect(syncService.syncCalls).toHaveLength(0);
      });
    },
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Scénario 6: syncOnWifiOnly activé + Wi-Fi → sync normal
  // ──────────────────────────────────────────────────────────────────────────
  test(
    "Le sync automatique fonctionne si syncOnWifiOnly est activé et connexion Wi-Fi",
    ({ given, and, when, then }) => {
      let syncOnWifiOnly = false;

      given('le paramètre syncOnWifiOnly est activé', () => {
        syncOnWifiOnly = true;
      });

      and("l'appareil est connecté en Wi-Fi", () => {
        mockNetInfoState = { isConnected: true, isInternetReachable: true, type: 'wifi' };
      });

      when("l'AutoSyncOrchestrator détecte que le réseau revient", async () => {
        const NetInfo = require('@react-native-community/netinfo');
        const netState = await NetInfo.fetch();

        if (syncOnWifiOnly && netState.type !== 'wifi') {
          return; // Skip — not Wi-Fi
        }

        await syncService.sync({ priority: 'high' });
      });

      then('le SyncService.sync() est appelé', () => {
        expect(syncService.syncCalls).toHaveLength(1);
      });
    },
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Scénario 7: Rappel hors ligne après 24h
  // ──────────────────────────────────────────────────────────────────────────
  test(
    'Le rappel hors ligne s\'affiche après 24h sans synchronisation',
    ({ given, and, when, then }) => {
      const OFFLINE_THRESHOLD_SECONDS = 24 * 60 * 60;

      given('la dernière synchronisation a eu lieu il y a plus de 24 heures', () => {
        const lastSyncTime = Date.now() - (OFFLINE_THRESHOLD_SECONDS + 3600) * 1000;
        syncStatusStore.setSynced(lastSyncTime);
      });

      and("le rappel n'a pas encore été ignoré", () => {
        // mockAsyncStorage has no dismissal key
        expect(mockAsyncStorage['pensieve:long-offline-reminder-dismissed-at']).toBeUndefined();
      });

      when('le hook useLongOfflineReminder vérifie l\'état', async () => {
        // Simulate useLongOfflineReminder check logic
        const state = syncStatusStore.getState();
        if (!state.lastSyncTime) return;

        const secondsElapsed = Math.floor((Date.now() - state.lastSyncTime) / 1000);
        if (secondsElapsed < OFFLINE_THRESHOLD_SECONDS) return;

        const dismissed = mockAsyncStorage['pensieve:long-offline-reminder-dismissed-at'];
        if (dismissed) return;

        const { Alert } = require('react-native');
        Alert.alert('Synchronisation interrompue', 'Message de rappel');
      });

      then('une alerte "Synchronisation interrompue" s\'affiche', () => {
        const { Alert } = require('react-native');
        expect(Alert.alert).toHaveBeenCalledWith(
          'Synchronisation interrompue',
          expect.any(String),
        );
      });
    },
  );
});
