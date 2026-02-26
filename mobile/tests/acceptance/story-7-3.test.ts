/**
 * BDD Acceptance Tests for Story 7.3: LLM Logs Analysis — Auto-generate GitHub Issues
 *
 * Test Strategy:
 * - Tests opèrent directement sur les services et stores (pas de rendu React)
 * - LogsAnalysisService.groupErrorLogs testé en BDD
 * - GitHubIssueService.createIssue + searchExistingIssue testés en BDD (AC6, AC7)
 * - settingsStore testé pour githubRepo
 * - Conditions d'affichage (AC1, AC9) vérifiées via logique pure
 * - AC3 (spinner), AC4 (modal), AC8 (feedback) : couverts par tests unitaires InAppLogger
 *
 * Run: npm run test:acceptance -- --testPathPattern="story-7-3"
 */

import { defineFeature, loadFeature } from 'jest-cucumber';

// Mock tsyringe before any import that uses @injectable
jest.mock('tsyringe', () => ({
  injectable: () => (_target: unknown) => _target,
  inject: () => (_target: unknown, _key: unknown, _index: unknown) => {},
}));

// Mock expo-secure-store (for AC6, AC7 GitHubIssueService tests)
const mockSecureStoreData: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStoreData[key] ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStoreData[key] = value;
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    delete mockSecureStoreData[key];
    return Promise.resolve();
  }),
}));

// Mock fetchWithRetry (for AC6, AC7 GitHubIssueService tests)
jest.mock('../../src/infrastructure/http/fetchWithRetry', () => ({
  fetchWithRetry: jest.fn(),
}));

// Mock LLM backends
jest.mock('../../src/contexts/Normalization/services/postprocessing/LlamaRnBackend', () => ({
  LlamaRnBackend: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isModelLoaded: jest.fn().mockReturnValue(true),
    loadModel: jest.fn().mockResolvedValue(true),
    processWithCustomPrompt: jest.fn(),
    dispose: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock('../../src/contexts/Normalization/services/postprocessing/MediaPipeBackend', () => ({
  MediaPipeBackend: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(false),
    isModelLoaded: jest.fn().mockReturnValue(false),
  })),
}));
jest.mock('../../src/contexts/Normalization/services/postprocessing/LitertLmBackend', () => ({
  LitertLmBackend: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(false),
    isModelLoaded: jest.fn().mockReturnValue(false),
  })),
}));

import { LogsAnalysisService } from '../../src/components/dev/services/LogsAnalysisService';
import { GitHubIssueService } from '../../src/components/dev/services/GitHubIssueService';
import { useLogsDebugStore, type LogEntry } from '../../src/components/dev/stores/logsDebugStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { RepositoryResultType } from '../../src/contexts/shared/domain/Result';
import { fetchWithRetry } from '../../src/infrastructure/http/fetchWithRetry';

const mockFetchWithRetry = fetchWithRetry as jest.Mock;

const feature = loadFeature('tests/acceptance/features/story-7-3.feature');

function makeLog(level: 'log' | 'error' | 'warn', message: string): LogEntry {
  return { timestamp: new Date(), level, message };
}

function makeMockModelService() {
  return {
    isPostProcessingEnabled: jest.fn().mockResolvedValue(true),
    getBestAvailableModelForTask: jest.fn().mockResolvedValue('test-model'),
    getModelConfig: jest.fn().mockReturnValue({ backend: 'llamarn' }),
    getModelPath: jest.fn().mockReturnValue('/models/test.gguf'),
  };
}

// Mirrors selectIsDebugModeEnabled logic
function checkDebugMode(): boolean {
  const state = useSettingsStore.getState();
  const hasDebugAccess = state.features['debug_mode'] ?? false;
  return state.debugMode && hasDebugAccess;
}

function shouldShowAnalyzeButton(): boolean {
  const isDebug = checkDebugMode();
  const errorCount = useLogsDebugStore.getState().logs.filter((l) => l.level === 'error').length;
  return isDebug && errorCount > 0;
}

function shouldShowBugReportingSection(): boolean {
  const { features, debugMode } = useSettingsStore.getState();
  return (features['debug_mode'] ?? false) && debugMode;
}

defineFeature(feature, (test) => {
  beforeEach(() => {
    useLogsDebugStore.setState({ logs: [], sniffing: true });
    useSettingsStore.setState({ features: {}, debugMode: false });
    // Reset mocks for AC6/AC7 tests
    jest.clearAllMocks();
    Object.keys(mockSecureStoreData).forEach((k) => delete mockSecureStoreData[k]);
  });

  test('AC1 — Bouton visible quand debug mode actif et erreurs présentes', ({ given, and, when, then }) => {
    given('le debug mode est activé', () => {
      useSettingsStore.setState({ features: { debug_mode: true }, debugMode: true });
    });

    and("le store contient au moins 1 log d'erreur", () => {
      useLogsDebugStore.setState({ logs: [makeLog('error', 'crash error')] });
    });

    when("j'évalue la visibilité du bouton Analyze", () => {
      // Visibility computed in then
    });

    then('le bouton Analyze est visible', () => {
      expect(shouldShowAnalyzeButton()).toBe(true);
    });
  });

  test('AC9 — Bouton masqué quand debug mode désactivé', ({ given, and, when, then }) => {
    given('le debug mode est désactivé', () => {
      useSettingsStore.setState({ features: {}, debugMode: false });
    });

    and("le store contient au moins 1 log d'erreur", () => {
      useLogsDebugStore.setState({ logs: [makeLog('error', 'crash error')] });
    });

    when("j'évalue la visibilité du bouton Analyze", () => {
      // Visibility computed in then
    });

    then("le bouton Analyze n'est pas visible", () => {
      expect(shouldShowAnalyzeButton()).toBe(false);
    });
  });

  test("AC2 — Extraction des logs d'erreur uniquement", ({ given, when, then }) => {
    let service: LogsAnalysisService;
    let grouped: LogEntry[];

    given("le store contient 5 logs d'erreur et 3 logs de niveau log", () => {
      const logs = [
        makeLog('error', 'error 1'),
        makeLog('log', 'info 1'),
        makeLog('error', 'error 2'),
        makeLog('warn', 'warn 1'),
        makeLog('error', 'error 3'),
        makeLog('log', 'info 2'),
        makeLog('error', 'error 4'),
        makeLog('log', 'info 3'),
        makeLog('error', 'error 5'),
      ];
      useLogsDebugStore.setState({ logs });
    });

    when('je groupe les logs d\'erreur via LogsAnalysisService', () => {
      // @ts-ignore
      service = new LogsAnalysisService(makeMockModelService());
      grouped = service.groupErrorLogs(useLogsDebugStore.getState().logs);
    });

    then('seuls 5 logs de niveau error sont retournés', () => {
      expect(grouped).toHaveLength(5);
      grouped.forEach((l) => expect(l.level).toBe('error'));
    });
  });

  test('AC2 — Limite à 20 erreurs les plus récentes', ({ given, when, then }) => {
    let service: LogsAnalysisService;
    let grouped: LogEntry[];

    given("le store contient 30 logs d'erreur", () => {
      const logs = Array.from({ length: 30 }, (_, i) => makeLog('error', `unique-error-${i}`));
      useLogsDebugStore.setState({ logs });
    });

    when('je groupe les logs d\'erreur via LogsAnalysisService', () => {
      // @ts-ignore
      service = new LogsAnalysisService(makeMockModelService());
      grouped = service.groupErrorLogs(useLogsDebugStore.getState().logs);
    });

    then('au plus 20 logs sont retournés', () => {
      expect(grouped.length).toBeLessThanOrEqual(20);
    });
  });

  test('AC5 — Section Bug Reporting visible en debug mode', ({ given, when, then }) => {
    given('le debug mode est activé', () => {
      useSettingsStore.setState({ features: { debug_mode: true }, debugMode: true });
    });

    when("j'évalue la visibilité de la section Bug Reporting dans Settings", () => {
      // computed in then
    });

    then('la section Bug Reporting est visible', () => {
      expect(shouldShowBugReportingSection()).toBe(true);
    });
  });

  test('AC9 — Section Bug Reporting masquée sans debug mode', ({ given, when, then }) => {
    given('le debug mode est désactivé', () => {
      useSettingsStore.setState({ features: {}, debugMode: false });
    });

    when("j'évalue la visibilité de la section Bug Reporting dans Settings", () => {
      // computed in then
    });

    then("la section Bug Reporting n'est pas visible", () => {
      expect(shouldShowBugReportingSection()).toBe(false);
    });
  });

  test('AC5 — SettingsStore persiste le repo GitHub', ({ given, when, then }) => {
    given('le store de paramètres est initialisé', () => {
      useSettingsStore.setState({ githubRepo: '' });
    });

    when('je configure githubRepo avec "owner/repo"', () => {
      useSettingsStore.getState().setGithubRepo('owner/repo');
    });

    then('githubRepo vaut "owner/repo" dans le store', () => {
      expect(useSettingsStore.getState().githubRepo).toBe('owner/repo');
    });
  });

  test('AC6 — Création GitHub Issue via API', ({ given, and, when, then }) => {
    let service: GitHubIssueService;
    let createResult: Awaited<ReturnType<GitHubIssueService['createIssue']>>;

    given('un GitHub token est configuré dans SecureStore', async () => {
      service = new GitHubIssueService();
      await service.setToken('ghp_test_token_ac6');
    });

    and('une analyse LLM a produit un titre et un corps', () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1,
          number: 42,
          title: 'Bug: crash on startup',
          html_url: 'https://github.com/owner/repo/issues/42',
          body: '## Summary\n\nCrash detected.',
          labels: [],
        }),
      });
    });

    when("je crée l'issue GitHub via GitHubIssueService", async () => {
      createResult = await service.createIssue(
        'owner',
        'repo',
        'Bug: crash on startup',
        '## Summary\n\nCrash detected.',
        ['bug']
      );
    });

    then("l'issue est créée et l'URL est retournée", () => {
      expect(createResult.type).toBe(RepositoryResultType.SUCCESS);
      expect(createResult.data?.number).toBe(42);
      expect(createResult.data?.html_url).toContain('/issues/42');
    });
  });

  test('AC7 — Déduplication : issue similaire existante détectée', ({ given, and, when, then }) => {
    let service: GitHubIssueService;
    let searchResult: Awaited<ReturnType<GitHubIssueService['searchExistingIssue']>>;

    given('un GitHub token est configuré dans SecureStore', async () => {
      service = new GitHubIssueService();
      await service.setToken('ghp_test_token_ac7');
    });

    and('une issue similaire existe dans le dépôt', () => {
      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 10,
              number: 5,
              title: 'Bug: crash loading database on startup',
              html_url: 'https://github.com/owner/repo/issues/5',
              body: 'existing body',
              labels: [],
            },
          ],
        }),
      });
    });

    when('je recherche une issue similaire via searchExistingIssue', async () => {
      searchResult = await service.searchExistingIssue(
        'owner',
        'repo',
        'Bug: crash loading database on startup'
      );
    });

    then("l'issue existante est retournée", () => {
      expect(searchResult.type).toBe(RepositoryResultType.SUCCESS);
      expect(searchResult.data).not.toBeNull();
      expect(searchResult.data?.number).toBe(5);
    });
  });
});
