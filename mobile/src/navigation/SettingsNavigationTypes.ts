/**
 * Settings navigation type definitions
 *
 * Extracted from SettingsStackNavigator to break circular dependencies:
 * SettingsStackNavigator → screens → SettingsStackNavigator
 */

export type SettingsStackParamList = {
  SettingsMain: undefined;
  TranscriptionEngineSettings: undefined;
  WhisperSettings: undefined;
  LLMSettings: undefined;
  ThemeSettings: undefined;
  NotificationSettings: undefined;
  LottieGallery: undefined;
  TodoDetailPopoverTest: undefined;
  SqlConsole: undefined;
  DataMining: undefined;
  QueryBuilder: { queryId?: string };
};
