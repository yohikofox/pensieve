/**
 * Jest Configuration for Pensieve Mobile
 *
 * IMPORTANT: We use a custom config instead of jest-expo preset
 *
 * Why not jest-expo?
 * - Expo SDK 54 uses "Winter" runtime for native module loading
 * - Winter only works in React Native environment, not in Node.js (Jest)
 * - Using jest-expo preset loads Winter setup, causing:
 *   "ReferenceError: You are trying to import a file outside of the scope"
 *
 * Solution:
 * - Minimal Jest config with babel-jest transform
 * - Mock WatermelonDB decorators (see __mocks__/@nozbe/watermelondb/decorators.js)
 * - Mock native dispatcher (see jest-setup.js)
 * - Use better-sqlite3 for Node.js SQLite support
 *
 * Trade-off: React Native component tests may need different config.
 * For now, this supports WatermelonDB model/service unit tests.
 */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@nozbe/watermelondb|expo|expo-.*|@expo|@react-native-community|react-native-safe-area-context|@kesha-antonov)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest-setup.js'],
  moduleNameMapper: {
    // Mock WatermelonDB decorators as no-ops for unit tests
    '^@nozbe/watermelondb/decorators$':
      '<rootDir>/__mocks__/@nozbe/watermelondb/decorators.js',
    // Mock react-native-file-hash native module
    '^@preeternal/react-native-file-hash$':
      '<rootDir>/__mocks__/@preeternal/react-native-file-hash/index.js',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js)'],
};
