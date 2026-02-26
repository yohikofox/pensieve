/**
 * BDD Acceptance Tests — Story 24.3: Feature Flag System — Adaptation Mobile & UI Gating
 *
 * Valide les comportements du feature flag system côté mobile :
 * - AC1 : UserFeatures = Record<string, boolean> + FEATURE_KEYS
 * - AC2 : settingsStore avec getFeature() + double gate debug mode
 * - AC3 : Tab Actualités masqué quand news_tab = false
 * - AC4 : Tab Projets masqué quand projects_tab = false
 * - AC5 : Boutons capture média masqués quand capture_media_buttons = false
 * - AC6 : Offline → features vides → all getFeature() = false
 *
 * Run: npm run test:acceptance
 */

import 'reflect-metadata';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { useSettingsStore, isDebugModeEnabled } from '../../src/stores/settingsStore';
import { FEATURE_KEYS } from '../../src/contexts/identity/domain/feature-keys';

const feature = loadFeature(
  'tests/acceptance/features/story-24-3-feature-flag-mobile.feature',
);

/**
 * Helper: parse "key=value" or "{}" into a Record<string, boolean>
 */
function parseFlags(input: string): Record<string, boolean> {
  if (input === '{}') return {};
  const pairs = input.split(',').map((s) => s.trim());
  return pairs.reduce<Record<string, boolean>>((acc, pair) => {
    const [key, value] = pair.split('=');
    acc[key.trim()] = value.trim() === 'true';
    return acc;
  }, {});
}

defineFeature(feature, (test) => {
  beforeEach(() => {
    useSettingsStore.setState({ features: {}, debugMode: false });
  });

  // ── AC3: Tab Actualités masqué quand news_tab = false ──────────────────────

  test("Le tab Actualités est masqué quand news_tab est false", ({
    given,
    when,
    then,
  }) => {
    let tabsToShow: string[];

    given(/^les feature flags suivants: "(.*)"$/, (flagsStr: string) => {
      const flags = parseFlags(flagsStr);
      useSettingsStore.setState({ features: flags });
    });

    when("j'affiche la navigation par tabs", () => {
      // Simulate MainNavigator filter logic
      const { getFeature } = useSettingsStore.getState();
      const allTabs = [
        { name: 'News', featureKey: FEATURE_KEYS.NEWS_TAB },
        { name: 'Captures', featureKey: undefined },
        { name: 'Capture', featureKey: undefined },
        { name: 'Actions', featureKey: undefined },
        { name: 'Projects', featureKey: FEATURE_KEYS.PROJECTS_TAB },
        { name: 'Settings', featureKey: undefined },
      ];
      tabsToShow = allTabs
        .filter((tab) => !tab.featureKey || getFeature(tab.featureKey))
        .map((tab) => tab.name);
    });

    then('le tab "Actualités" n\'est pas rendu', () => {
      expect(tabsToShow).not.toContain('News');
    });
  });

  test("Le tab Actualités est visible quand news_tab est true", ({
    given,
    when,
    then,
  }) => {
    let tabsToShow: string[];

    given(/^les feature flags suivants: "(.*)"$/, (flagsStr: string) => {
      const flags = parseFlags(flagsStr);
      useSettingsStore.setState({ features: flags });
    });

    when("j'affiche la navigation par tabs", () => {
      const { getFeature } = useSettingsStore.getState();
      const allTabs = [
        { name: 'News', featureKey: FEATURE_KEYS.NEWS_TAB },
        { name: 'Captures', featureKey: undefined },
        { name: 'Capture', featureKey: undefined },
        { name: 'Actions', featureKey: undefined },
        { name: 'Projects', featureKey: FEATURE_KEYS.PROJECTS_TAB },
        { name: 'Settings', featureKey: undefined },
      ];
      tabsToShow = allTabs
        .filter((tab) => !tab.featureKey || getFeature(tab.featureKey))
        .map((tab) => tab.name);
    });

    then('le tab "Actualités" est rendu', () => {
      expect(tabsToShow).toContain('News');
    });
  });

  // ── AC4: Tab Projets masqué quand projects_tab = false ─────────────────────

  test("Le tab Projets est masqué quand projects_tab est false", ({
    given,
    when,
    then,
  }) => {
    let tabsToShow: string[];

    given(/^les feature flags suivants: "(.*)"$/, (flagsStr: string) => {
      const flags = parseFlags(flagsStr);
      useSettingsStore.setState({ features: flags });
    });

    when("j'affiche la navigation par tabs", () => {
      const { getFeature } = useSettingsStore.getState();
      const allTabs = [
        { name: 'News', featureKey: FEATURE_KEYS.NEWS_TAB },
        { name: 'Captures', featureKey: undefined },
        { name: 'Capture', featureKey: undefined },
        { name: 'Actions', featureKey: undefined },
        { name: 'Projects', featureKey: FEATURE_KEYS.PROJECTS_TAB },
        { name: 'Settings', featureKey: undefined },
      ];
      tabsToShow = allTabs
        .filter((tab) => !tab.featureKey || getFeature(tab.featureKey))
        .map((tab) => tab.name);
    });

    then('le tab "Projets" n\'est pas rendu', () => {
      expect(tabsToShow).not.toContain('Projects');
    });
  });

  test("Le tab Projets est visible quand projects_tab est true", ({
    given,
    when,
    then,
  }) => {
    let tabsToShow: string[];

    given(/^les feature flags suivants: "(.*)"$/, (flagsStr: string) => {
      const flags = parseFlags(flagsStr);
      useSettingsStore.setState({ features: flags });
    });

    when("j'affiche la navigation par tabs", () => {
      const { getFeature } = useSettingsStore.getState();
      const allTabs = [
        { name: 'News', featureKey: FEATURE_KEYS.NEWS_TAB },
        { name: 'Captures', featureKey: undefined },
        { name: 'Capture', featureKey: undefined },
        { name: 'Actions', featureKey: undefined },
        { name: 'Projects', featureKey: FEATURE_KEYS.PROJECTS_TAB },
        { name: 'Settings', featureKey: undefined },
      ];
      tabsToShow = allTabs
        .filter((tab) => !tab.featureKey || getFeature(tab.featureKey))
        .map((tab) => tab.name);
    });

    then('le tab "Projets" est rendu', () => {
      expect(tabsToShow).toContain('Projects');
    });
  });

  // ── AC5: Boutons capture média masqués quand capture_media_buttons = false ──

  test("Les boutons capture média sont masqués quand capture_media_buttons est false", ({
    given,
    when,
    then,
    and,
  }) => {
    let visibleToolIds: string[];

    given(/^les feature flags suivants: "(.*)"$/, (flagsStr: string) => {
      const flags = parseFlags(flagsStr);
      useSettingsStore.setState({ features: flags });
    });

    when("j'ouvre l'écran Capturer", () => {
      // Simulate CaptureScreenContent filtering logic
      const { getFeature } = useSettingsStore.getState();
      const showMediaButtons = getFeature(FEATURE_KEYS.CAPTURE_MEDIA_BUTTONS);

      const alwaysTools = ['voice', 'text'];
      const mediaTools = ['photo', 'url', 'document', 'clipboard'];

      visibleToolIds = showMediaButtons
        ? [...alwaysTools, ...mediaTools]
        : alwaysTools;
    });

    then('les boutons "photo", "url", "document" et "clipboard" ne sont pas rendus', () => {
      expect(visibleToolIds).not.toContain('photo');
      expect(visibleToolIds).not.toContain('url');
      expect(visibleToolIds).not.toContain('document');
      expect(visibleToolIds).not.toContain('clipboard');
    });

    and('le bouton d\'enregistrement audio reste visible', () => {
      expect(visibleToolIds).toContain('voice');
    });
  });

  test("Les boutons capture média sont visibles quand capture_media_buttons est true", ({
    given,
    when,
    then,
  }) => {
    let visibleToolIds: string[];

    given(/^les feature flags suivants: "(.*)"$/, (flagsStr: string) => {
      const flags = parseFlags(flagsStr);
      useSettingsStore.setState({ features: flags });
    });

    when("j'ouvre l'écran Capturer", () => {
      const { getFeature } = useSettingsStore.getState();
      const showMediaButtons = getFeature(FEATURE_KEYS.CAPTURE_MEDIA_BUTTONS);

      const alwaysTools = ['voice', 'text'];
      const mediaTools = ['photo', 'url', 'document', 'clipboard'];

      visibleToolIds = showMediaButtons
        ? [...alwaysTools, ...mediaTools]
        : alwaysTools;
    });

    then('les boutons "photo", "url", "document" et "clipboard" sont rendus', () => {
      expect(visibleToolIds).toContain('photo');
      expect(visibleToolIds).toContain('url');
      expect(visibleToolIds).toContain('document');
      expect(visibleToolIds).toContain('clipboard');
    });
  });

  // ── AC6: Offline → features vides → all getFeature() = false ───────────────

  test("Offline avec cache expiré — toutes les features retournent false", ({
    given,
    when,
    then,
    and,
  }) => {
    given(/^les feature flags suivants: "(.*)"$/, (flagsStr: string) => {
      // Accept "{}" as empty features
      useSettingsStore.setState({ features: {} });
    });

    when('les feature flags sont vides (cache expiré offline)', () => {
      // Features are already {} — this represents the offline safe default
      const { features } = useSettingsStore.getState();
      expect(features).toEqual({});
    });

    then('getFeature retourne false pour "news_tab"', () => {
      const { getFeature } = useSettingsStore.getState();
      expect(getFeature(FEATURE_KEYS.NEWS_TAB)).toBe(false);
    });

    and('getFeature retourne false pour "projects_tab"', () => {
      const { getFeature } = useSettingsStore.getState();
      expect(getFeature(FEATURE_KEYS.PROJECTS_TAB)).toBe(false);
    });

    and('getFeature retourne false pour "capture_media_buttons"', () => {
      const { getFeature } = useSettingsStore.getState();
      expect(getFeature(FEATURE_KEYS.CAPTURE_MEDIA_BUTTONS)).toBe(false);
    });

    and('getFeature retourne false pour "debug_mode"', () => {
      const { getFeature } = useSettingsStore.getState();
      expect(getFeature(FEATURE_KEYS.DEBUG_MODE)).toBe(false);
    });
  });

  // ── AC2: Double gate debug mode préservé ────────────────────────────────────

  test("Le double gate debug mode est préservé après setFeatures", ({
    given,
    when,
    then,
  }) => {
    given(/^les feature flags suivants: "(.*)"$/, (flagsStr: string) => {
      const flags = parseFlags(flagsStr);
      useSettingsStore.setState({ features: flags });
    });

    when("le toggle debugMode est activé par l'utilisateur", () => {
      useSettingsStore.getState().setDebugMode(true);
    });

    then('isDebugModeEnabled retourne true', () => {
      expect(isDebugModeEnabled()).toBe(true);
    });

    when(/^les feature flags sont mis à jour avec "(.*)"$/, (flagsStr: string) => {
      const flags = parseFlags(flagsStr);
      useSettingsStore.getState().setFeatures(flags);
    });

    then('isDebugModeEnabled retourne false', () => {
      expect(isDebugModeEnabled()).toBe(false);
    });
  });
});
