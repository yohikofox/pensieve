import { device } from 'detox';

/**
 * Global setup for Detox E2E tests
 * Runs before all test suites
 */
beforeAll(async () => {
  // Launch app with microphone permissions granted
  await device.launchApp({
    newInstance: true,
    permissions: {
      microphone: 'YES',
      notifications: 'YES',
    },
  });
});

/**
 * Reset app state before each test
 */
beforeEach(async () => {
  // Reload React Native to ensure clean state
  await device.reloadReactNative();
});

/**
 * Cleanup after each test
 */
afterEach(async () => {
  // Take screenshot on failure (artifact captured automatically by Detox)
});

/**
 * Global teardown
 */
afterAll(async () => {
  // Detox handles cleanup automatically
});
