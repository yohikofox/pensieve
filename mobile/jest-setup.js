/**
 * Jest Setup for Pensieve Mobile
 *
 * Critical configuration for testing with OP-SQLite + Expo SDK 54
 *
 * Note: We don't use jest-expo preset to avoid Expo "Winter" runtime issues
 * in Node.js test environment. See jest.config.js for details.
 */

// ==========================================
// Global React Native Variables
// ==========================================
global.__DEV__ = true;

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
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    removeEventListener: jest.fn(),
  },
  Alert: {
    alert: jest.fn(),
  },
  StyleSheet: {
    create: jest.fn((styles) => styles),
    flatten: jest.fn((style) => style),
    hairlineWidth: 1,
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Animated: {
    View: 'AnimatedView',
    Text: 'AnimatedText',
    Value: jest.fn(() => ({
      setValue: jest.fn(),
      interpolate: jest.fn(() => ({})),
      stopAnimation: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    })),
    timing: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb()),
    })),
    spring: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb()),
    })),
    sequence: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb()),
    })),
    parallel: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb()),
    })),
    loop: jest.fn(() => ({
      start: jest.fn(),
      stop: jest.fn(),
    })),
  },
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
}));

// ==========================================
// Expo File System Mock (SDK 54 new API)
// ==========================================
// Mock expo-file-system with new File/Paths classes
jest.mock('expo-file-system', () => {
  // Mock File class
  class MockFile {
    constructor(directory, filename) {
      this.directory = directory;
      this.filename = filename;
      this.uri = `${directory}/${filename}`;
      this._exists = false;
      this._content = null;
    }

    get exists() {
      return this._exists;
    }

    write(data) {
      this._content = data;
      this._exists = true;
      return Promise.resolve();
    }

    delete() {
      this._content = null;
      this._exists = false;
      return Promise.resolve();
    }

    text() {
      return Promise.resolve(this._content?.toString() || '');
    }
  }

  return {
    File: MockFile,
    Paths: {
      document: 'file:///mock/documents',
      cache: 'file:///mock/cache',
    },
  };
});

// Mock expo-file-system/legacy for any remaining legacy usage
jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn(() => Promise.resolve()),
  getFreeDiskStorageAsync: jest.fn(() => Promise.resolve(1024 * 1024 * 1024)), // 1GB default
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true, size: 1024 })), // Default: file exists
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  documentDirectory: 'file:///mock/documents/',
  cacheDirectory: 'file:///mock/cache/',
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
}));

// ==========================================
// Expo Fetch Mock
// ==========================================
// Mock expo/fetch for streaming download tests
jest.mock('expo/fetch', () => ({
  fetch: jest.fn(),
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
  useAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    stop: jest.fn(),
    seekTo: jest.fn(),
    setVolume: jest.fn(),
  })),
  useAudioPlayerStatus: jest.fn(() => ({
    playing: false,
    didJustFinish: false,
    currentTime: 0,
    duration: 0,
    isLoaded: false,
    isBuffering: false,
  })),
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

// ==========================================
// OP-SQLite Mock (per-test basis)
// ==========================================
// Note: OP-SQLite is mocked in individual tests using jest.mock()
// See test files for database mocking strategy

// ==========================================
// React Native Audio API Mock (Audio Conversion)
// ==========================================
// Mock react-native-audio-api for audio conversion tests
jest.mock('react-native-audio-api', () => {
  // Mock AudioBuffer
  class MockAudioBuffer {
    constructor(options) {
      this.numberOfChannels = options?.numberOfChannels || 1;
      this.length = options?.length || 16000;
      this.sampleRate = options?.sampleRate || 16000;
      this.duration = this.length / this.sampleRate;
      this._channelData = new Float32Array(this.length);
    }

    getChannelData(channel) {
      return this._channelData;
    }
  }

  // Mock OfflineAudioContext
  class MockOfflineAudioContext {
    constructor(options) {
      this.numberOfChannels = options?.numberOfChannels || 1;
      this.length = options?.length || 16000;
      this.sampleRate = options?.sampleRate || 16000;
      this.destination = {};
    }

    createBufferSource() {
      return {
        buffer: null,
        connect: jest.fn(),
        start: jest.fn(),
      };
    }

    startRendering() {
      return Promise.resolve(new MockAudioBuffer({
        numberOfChannels: this.numberOfChannels,
        length: this.length,
        sampleRate: this.sampleRate,
      }));
    }
  }

  return {
    decodeAudioData: jest.fn((path, sampleRate) => {
      return Promise.resolve(new MockAudioBuffer({
        numberOfChannels: 2,
        length: sampleRate || 16000,
        sampleRate: sampleRate || 16000,
      }));
    }),
    OfflineAudioContext: MockOfflineAudioContext,
  };
});
