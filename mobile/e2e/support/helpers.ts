import { device, expect as detoxExpect, element, by, waitFor } from 'detox';

/**
 * Helper functions for Detox E2E tests
 * Following TEA knowledge base patterns
 */

/**
 * Wait for element to be visible with timeout
 * @param testID - Element testID
 * @param timeout - Timeout in ms (default: 5000)
 */
export const waitForElement = async (testID: string, timeout: number = 5000) => {
  await waitFor(element(by.id(testID)))
    .toBeVisible()
    .withTimeout(timeout);
};

/**
 * Tap element by testID
 * @param testID - Element testID
 */
export const tapElement = async (testID: string) => {
  await element(by.id(testID)).tap();
};

/**
 * Type text into input field
 * @param testID - Input field testID
 * @param text - Text to type
 */
export const typeText = async (testID: string, text: string) => {
  await element(by.id(testID)).typeText(text);
};

/**
 * Clear text from input field
 * @param testID - Input field testID
 */
export const clearText = async (testID: string) => {
  await element(by.id(testID)).clearText();
};

/**
 * Verify element has text
 * @param testID - Element testID
 * @param text - Expected text
 */
export const expectText = async (testID: string, text: string) => {
  await detoxExpect(element(by.id(testID))).toHaveText(text);
};

/**
 * Verify element is visible
 * @param testID - Element testID
 */
export const expectVisible = async (testID: string) => {
  await detoxExpect(element(by.id(testID))).toBeVisible();
};

/**
 * Verify element is not visible
 * @param testID - Element testID
 */
export const expectNotVisible = async (testID: string) => {
  await detoxExpect(element(by.id(testID))).not.toBeVisible();
};

/**
 * Reload React Native app
 */
export const reloadApp = async () => {
  await device.reloadReactNative();
};

/**
 * Simulate app termination (for crash recovery testing)
 */
export const terminateApp = async () => {
  await device.terminateApp();
};

/**
 * Launch app
 */
export const launchApp = async (permissions?: { [key: string]: string }) => {
  await device.launchApp({
    newInstance: true,
    permissions,
  });
};

/**
 * Simulate offline mode (disable network)
 */
export const goOffline = async () => {
  // iOS only - Android requires different approach
  if (device.getPlatform() === 'ios') {
    await device.setURLBlacklist(['.*']);
  }
};

/**
 * Restore online mode (enable network)
 */
export const goOnline = async () => {
  if (device.getPlatform() === 'ios') {
    await device.setURLBlacklist([]);
  }
};

/**
 * Measure performance (time between two actions)
 * @param actionName - Name of action being measured
 * @param action - Async function to measure
 * @returns Duration in milliseconds
 */
export const measurePerformance = async (
  actionName: string,
  action: () => Promise<void>
): Promise<number> => {
  const start = Date.now();
  await action();
  const duration = Date.now() - start;
  console.log(`[PERFORMANCE] ${actionName}: ${duration}ms`);
  return duration;
};
