/**
 * Jest Setup for Pensieve Mobile
 *
 * Critical configuration for testing with WatermelonDB + Expo SDK 54
 *
 * Note: We don't use jest-expo preset to avoid Expo "Winter" runtime issues
 * in Node.js test environment. See jest.config.js for details.
 */

// ==========================================
// WatermelonDB Test Support
// ==========================================
// Mock native SQLite dispatcher to use Node.js version (with better-sqlite3)
// This allows WatermelonDB to run in Jest without React Native environment
//
// Sources:
// - https://github.com/Nozbe/WatermelonDB/issues/155
// - https://craigmulligan.com/posts/testing-with-watermelon/
jest.mock(
  '@nozbe/watermelondb/adapters/sqlite/makeDispatcher/index.native.js',
  () => {
    return jest.requireActual(
      '@nozbe/watermelondb/adapters/sqlite/makeDispatcher/index.js'
    );
  }
);

// ==========================================
// React Native Mocks
// ==========================================
// Mock AsyncStorage (required by Supabase and other RN libraries)
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock React Native core modules
jest.mock('react-native', () => ({
  Linking: {
    openSettings: jest.fn(() => Promise.resolve()),
    openURL: jest.fn(() => Promise.resolve()),
    canOpenURL: jest.fn(() => Promise.resolve(true)),
  },
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios),
  },
}));

// ==========================================
// Expo Audio Mock
// ==========================================
// Mock expo-audio to avoid native module dependencies in unit tests
// expo-audio uses ESM syntax which Jest can't handle in Node environment
jest.mock('expo-audio', () => ({
  requestRecordingPermissionsAsync: jest.fn(() =>
    Promise.resolve({
      granted: true,
      canAskAgain: true,
      expires: 'never',
    })
  ),
  getRecordingPermissionsAsync: jest.fn(() =>
    Promise.resolve({
      granted: true,
      canAskAgain: true,
      expires: 'never',
    })
  ),
  useAudioRecorder: jest.fn(),
  useAudioRecorderState: jest.fn(),
  RecordingPresets: {
    HIGH_QUALITY: {},
  },
}));

// ==========================================
// Supabase Mock
// ==========================================
// Mock Supabase client to avoid network calls in unit tests
jest.mock('./src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() =>
        Promise.resolve({
          data: { session: { access_token: 'mock-token' } },
          error: null,
        })
      ),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
    },
  },
}));
