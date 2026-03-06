/**
 * Story 8.22: Registry AC3 & AC4 — Feature keys orientés capacité produit
 *
 * Vérifie que tabScreens.News et tabScreens.Projects utilisent les nouveaux
 * feature keys orientés capacité produit (AC3/AC4), et que les tabs permanents
 * n'ont pas de featureKey (AC6 — toujours visibles).
 *
 * Utilise babel-jest (jest.config.js) pour permettre l'import de registry.ts
 * qui référence des composants React Native incompatibles avec ts-jest.
 * Exécuté via : npm run test:unit
 */

// Mocks AVANT tout import de registry.ts
jest.mock('../news/NewsScreen', () => ({ NewsScreen: 'NewsScreen' }));
jest.mock('../../navigation/CapturesStackNavigator', () => ({
  CapturesStackNavigator: 'CapturesStackNavigator',
}));
jest.mock('../capture/CaptureScreen', () => ({ CaptureScreen: 'CaptureScreen' }));
jest.mock('../actions/ActionsScreen', () => ({ ActionsScreen: 'ActionsScreen' }));
jest.mock('../projects/ProjectsScreen', () => ({ ProjectsScreen: 'ProjectsScreen' }));
jest.mock('../../navigation/SettingsStackNavigator', () => ({
  SettingsStackNavigator: 'SettingsStackNavigator',
}));
jest.mock('../../navigation/components', () => ({ TabIcons: {} }));
jest.mock('@react-navigation/bottom-tabs', () => ({}));

import { tabScreens } from '../registry';
import { FEATURE_KEYS } from '../../contexts/identity/domain/feature-keys';

describe('Story 8.22 — Registry AC3: Tab News gérée par capacité produit "news"', () => {
  it('tabScreens.News.featureKey correspond à FEATURE_KEYS.NEWS', () => {
    expect(tabScreens.News.featureKey).toBe(FEATURE_KEYS.NEWS);
  });

  it('tabScreens.News.featureKey vaut la string "news"', () => {
    expect(tabScreens.News.featureKey).toBe('news');
  });

  it('tabScreens.News.featureKey ne vaut plus "news_tab" (ancien flag déprécié)', () => {
    expect(tabScreens.News.featureKey).not.toBe(FEATURE_KEYS.NEWS_TAB);
    expect(tabScreens.News.featureKey).not.toBe('news_tab');
  });
});

describe('Story 8.22 — Registry AC4: Tab Projects gérée par capacité produit "projects"', () => {
  it('tabScreens.Projects.featureKey correspond à FEATURE_KEYS.PROJECTS', () => {
    expect(tabScreens.Projects.featureKey).toBe(FEATURE_KEYS.PROJECTS);
  });

  it('tabScreens.Projects.featureKey vaut la string "projects"', () => {
    expect(tabScreens.Projects.featureKey).toBe('projects');
  });

  it('tabScreens.Projects.featureKey ne vaut plus "projects_tab" (ancien flag déprécié)', () => {
    expect(tabScreens.Projects.featureKey).not.toBe(FEATURE_KEYS.PROJECTS_TAB);
    expect(tabScreens.Projects.featureKey).not.toBe('projects_tab');
  });
});

describe('Story 8.22 — Registry AC6: Tabs permanents sans featureKey (toujours visibles)', () => {
  it('Captures — pas de featureKey, toujours visible', () => {
    expect(tabScreens.Captures.featureKey).toBeUndefined();
  });

  it('Capture — pas de featureKey, toujours visible', () => {
    expect(tabScreens.Capture.featureKey).toBeUndefined();
  });

  it('Actions — pas de featureKey, toujours visible', () => {
    expect(tabScreens.Actions.featureKey).toBeUndefined();
  });

  it('Settings — pas de featureKey, toujours visible', () => {
    expect(tabScreens.Settings.featureKey).toBeUndefined();
  });
});
