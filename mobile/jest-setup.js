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
// Animation Frame Polyfill
// ==========================================
global.requestAnimationFrame = (cb) => {
  return setTimeout(cb, 16); // ~60fps
};

global.cancelAnimationFrame = (id) => {
  clearTimeout(id);
};

// ==========================================
// React Native Mocks
// ==========================================
// Mock AsyncStorage (required by Supabase and other RN libraries)
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock React Native core modules with proper component mocks
// Note: We use string-based mocks for simplicity in most tests
// If a test needs React.createElement, it can override locally with jest.doMock
jest.mock('react-native', () => {
  // AnimatedValue mock class for proper state management
  class AnimatedValueMock {
    constructor(initialValue) {
      this._value = initialValue;
    }
    setValue(value) {
      this._value = value;
    }
    getValue() {
      return this._value;
    }
    interpolate() {
      return {};
    }
    stopAnimation() {}
    addListener() {}
    removeListener() {}
  }

  return {
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
    Appearance: {
      getColorScheme: jest.fn(() => 'light'),
      addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
      removeChangeListener: jest.fn(),
    },
    useColorScheme: jest.fn(() => 'light'),
    Alert: {
      alert: jest.fn(),
    },
    StyleSheet: {
      create: jest.fn((styles) => styles),
      flatten: jest.fn((style) => style),
      hairlineWidth: 1,
    },
    NativeModules: {
      RNVectorIconsManager: {
        getImageForFont: jest.fn(() => Promise.resolve({ uri: 'mock-icon' })),
      },
    },
    View: 'View',
    Text: 'Text',
    TextInput: 'TextInput',
    TouchableOpacity: 'TouchableOpacity',
    TouchableWithoutFeedback: 'TouchableWithoutFeedback',
    ScrollView: 'ScrollView',
    Modal: 'Modal',
    Keyboard: {
      dismiss: jest.fn(),
      addListener: jest.fn(() => ({ remove: jest.fn() })),
      removeListener: jest.fn(),
    },
    KeyboardAvoidingView: 'KeyboardAvoidingView',
    Animated: {
      View: 'AnimatedView',
      Text: 'AnimatedText',
      Value: AnimatedValueMock,
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
    PanResponder: {
      create: jest.fn((config) => ({
        panHandlers: {
          onStartShouldSetResponder: config.onStartShouldSetPanResponder,
          onMoveShouldSetResponder: config.onMoveShouldSetPanResponder,
          onResponderGrant: config.onPanResponderGrant,
          onResponderMove: config.onPanResponderMove,
          onResponderRelease: config.onPanResponderRelease,
          onResponderTerminate: config.onPanResponderTerminate,
        },
      })),
    },
  };
});

// ==========================================
// Expo File System Mock (SDK 54 Modern API)
// ==========================================
// Mock expo-file-system with complete File/Directory/Paths/StorageVolume classes
// Tech Stack: Node 22, Expo SDK 54, expo-file-system 19.x
jest.mock('expo-file-system', () => {
  // In-memory file storage for tests
  const mockFiles = new Map();

  // Mock File class (complete implementation)
  class MockFile {
    constructor(pathOrDirectory, filename) {
      // Support both single-arg (path) and two-arg (directory, filename) constructor
      let fullPath;
      if (filename) {
        // Two args: combine directory and filename
        const dir = typeof pathOrDirectory === 'string' ? pathOrDirectory : pathOrDirectory.uri || pathOrDirectory;
        const cleanDir = dir.replace('file://', '').replace(/\/+$/, '');
        fullPath = `${cleanDir}/${filename}`;
      } else {
        // Single arg: use as full path
        fullPath = pathOrDirectory.replace('file://', '');
      }

      this.uri = fullPath.startsWith('file://') ? fullPath : `file://${fullPath}`;
      this.path = fullPath.replace('file://', '');
    }

    info() {
      const data = mockFiles.get(this.path);
      return {
        exists: data !== undefined,
        size: data?.size || 0,
        modificationTime: data?.modificationTime || Date.now(),
        creationTime: data?.creationTime || Date.now(),
        type: data?.type || 'file',
      };
    }

    async write(content) {
      const size = typeof content === 'string' ? content.length : content.byteLength;
      mockFiles.set(this.path, {
        content,
        size,
        modificationTime: Date.now(),
        creationTime: mockFiles.get(this.path)?.creationTime || Date.now(),
        type: 'file',
      });
      return Promise.resolve();
    }

    async text() {
      const data = mockFiles.get(this.path);
      if (!data) throw new Error('File not found');
      return Promise.resolve(data.content?.toString() || '');
    }

    async delete() {
      mockFiles.delete(this.path);
      return Promise.resolve();
    }

    async copy(destinationFile) {
      const data = mockFiles.get(this.path);
      if (!data) throw new Error('Source file not found');
      mockFiles.set(destinationFile.path, { ...data });
      return Promise.resolve();
    }
  }

  // Mock Directory class
  class MockDirectory {
    constructor(path) {
      this.uri = path.startsWith('file://') ? path : `file://${path}`;
      this.path = path.replace('file://', '');
    }

    info() {
      return {
        exists: true, // Directories always exist in mock
        type: 'directory',
      };
    }

    async create(options) {
      // Mock: directories are always created successfully
      return Promise.resolve();
    }

    async list() {
      // Return list of files in this directory
      const dirPath = this.path.endsWith('/') ? this.path : `${this.path}/`;
      const files = [];
      for (const [path, _] of mockFiles.entries()) {
        if (path.startsWith(dirPath)) {
          const relativePath = path.substring(dirPath.length);
          if (!relativePath.includes('/')) {
            files.push(relativePath);
          }
        }
      }
      return Promise.resolve(files);
    }
  }

  // Mock StorageVolume class
  const MockStorageVolume = {
    getAvailableSpaceAsync: jest.fn(() => Promise.resolve(1024 * 1024 * 1024)), // 1GB default
  };

  return {
    File: MockFile,
    Directory: MockDirectory,
    StorageVolume: MockStorageVolume,
    Paths: {
      document: '/mock/documents',
      cache: '/mock/cache',
      bundle: '/mock/bundle',
    },
    // Clear mock files between tests (helper)
    __clearMockFiles: () => mockFiles.clear(),
  };
});

// ==========================================
// REMOVED: expo-file-system/legacy mock
// ==========================================
// We no longer use /legacy API (Node 22, Expo SDK 54)
// All filesystem operations use modern API (File, Directory, Paths, StorageVolume)
// If you see errors about missing /legacy, the code needs to be migrated to modern API

// ==========================================
// Expo Modules Core Mock
// ==========================================
jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn(() => ({})),
  requireOptionalNativeModule: jest.fn(() => null), // Return null for optional modules
  EventEmitter: jest.fn(),
  NativeModulesProxy: {
    EXDevLauncher: null, // Not available in test environment
    ExpoConstants: {
      manifest: {},
      systemFonts: [],
      statusBarHeight: 0,
    },
  },
}));

// ==========================================
// Expo Constants Mock
// ==========================================
// Mock expo-constants to avoid native module dependencies
jest.mock('expo-constants', () => ({
  default: {
    manifest: {},
    systemFonts: [],
    statusBarHeight: 0,
    deviceName: 'Test Device',
    isDevice: false,
  },
  ExecutionEnvironment: {
    Bare: 'bare',
    Standalone: 'standalone',
    StoreClient: 'storeClient',
  },
}));

// ==========================================
// Expo Vector Icons Mock
// ==========================================
// Mock @expo/vector-icons to avoid complex native dependencies
jest.mock('@expo/vector-icons', () => ({
  Feather: 'Feather',
  MaterialIcons: 'MaterialIcons',
  Ionicons: 'Ionicons',
  FontAwesome: 'FontAwesome',
  AntDesign: 'AntDesign',
  Entypo: 'Entypo',
  EvilIcons: 'EvilIcons',
  FontAwesome5: 'FontAwesome5',
  Foundation: 'Foundation',
  MaterialCommunityIcons: 'MaterialCommunityIcons',
  Octicons: 'Octicons',
  SimpleLineIcons: 'SimpleLineIcons',
  Zocial: 'Zocial',
}));

// ==========================================
// React Native Safe Area Context Mock
// ==========================================
// Mock react-native-safe-area-context for UI tests
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn(() => ({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  })),
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: 'SafeAreaView',
  SafeAreaInsetsContext: {
    Consumer: ({ children }) => children({ top: 0, right: 0, bottom: 0, left: 0 }),
  },
}));

// ==========================================
// React Native NetInfo Mock
// ==========================================
// Mock @react-native-community/netinfo for network status tests
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
      details: {},
    })
  ),
  addEventListener: jest.fn(() => jest.fn()), // Returns unsubscribe function
}));

// ==========================================
// React i18next Mock
// ==========================================
// Mock react-i18next for internationalization tests
jest.mock('react-i18next', () => {
  // Translation map for French (default language in app)
  const translations = {
    'capture.textCapture.placeholder': 'Notez votre pensée...',
    'capture.textCapture.hint': 'Minimum 3 caractères',
    'capture.textCapture.tooShort': 'Le texte est trop court (minimum 3 caractères)',
    'capture.textCapture.emptyError': 'Veuillez entrer du texte',
    'capture.textCapture.saveError': 'Erreur lors de la sauvegarde. Veuillez réessayer.',
    'capture.textCapture.saved': 'Sauvegardé',
    'capture.textCapture.discardTitle': 'Rejeter la capture?',
    'capture.textCapture.discardMessage': 'Le texte non sauvegardé sera perdu.',
    'capture.textCapture.continueEditing': "Continuer l'édition",
    'capture.textCapture.discard': 'Rejeter',
    'common.cancel': 'Annuler',
    'common.confirm': 'Confirmer',
    'common.save': 'Enregistrer',
    'common.delete': 'Supprimer',
    'common.ok': 'OK',
    'common.yes': 'Oui',
    'common.no': 'Non',
    'common.retry': 'Réessayer',
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
  };

  return {
    useTranslation: () => ({
      t: (key) => translations[key] || key,
      i18n: {
        changeLanguage: jest.fn(),
        language: 'fr',
      },
    }),
    Trans: ({ children }) => children,
    initReactI18next: {
      type: '3rdParty',
      init: jest.fn(),
    },
  };
});

// ==========================================
// Expo Speech Recognition Mock
// ==========================================
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: jest.fn(() => Promise.resolve(true)),
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
  },
  AudioEncodingAndroid: {},
  ExpoWebSpeechRecognition: jest.fn(),
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
// NativeWind Mock
// ==========================================
// Mock nativewind to avoid JSX parsing issues in tests
jest.mock('nativewind', () => ({
  colorScheme: {
    get: jest.fn(() => 'light'),
    set: jest.fn(),
    toggle: jest.fn(),
  },
  vars: jest.fn(),
  useColorScheme: jest.fn(() => ({
    colorScheme: 'light',
    setColorScheme: jest.fn(),
    toggleColorScheme: jest.fn(),
  })),
}));

// ==========================================
// React Native Reanimated Mock
// ==========================================
// Mock react-native-reanimated for animation tests (Story 5.1 Task 8)
jest.mock('react-native-reanimated', () => {
  // Custom inline mock (official mock is ESM and causes issues with Jest)
  return {
    default: {
      View: 'Animated.View',
      Text: 'Animated.Text',
      ScrollView: 'Animated.ScrollView',
      createAnimatedComponent: (component) => component,
    },
    View: 'Animated.View',
    Text: 'Animated.Text',
    ScrollView: 'Animated.ScrollView',
    useSharedValue: (initialValue) => ({
      value: initialValue,
    }),
    useAnimatedStyle: (callback) => callback(),
    withSpring: (value) => value,
    withTiming: (value) => value,
    withSequence: (...values) => values[values.length - 1],
    runOnJS: (fn) => fn,
    Easing: {
      linear: jest.fn(),
      ease: jest.fn(),
      quad: jest.fn(),
      cubic: jest.fn(),
    },
    createAnimatedComponent: (component) => component,
  };
});

// ==========================================
// Expo Haptics Mock
// ==========================================
// Mock expo-haptics for haptic feedback tests
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

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
