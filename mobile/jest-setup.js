// Minimal Jest setup for Expo SDK 54
// Only mock native modules that don't exist in test environment

// Mock AsyncStorage (required by Supabase client)
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Supabase client to avoid network calls in tests
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
