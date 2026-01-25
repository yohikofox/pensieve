/**
 * Mock for expo-clipboard
 *
 * Used in Jest tests to avoid native module errors
 */

export const setStringAsync = jest.fn().mockResolvedValue(true);

export const getStringAsync = jest.fn().mockResolvedValue('');

export const hasStringAsync = jest.fn().mockResolvedValue(false);
