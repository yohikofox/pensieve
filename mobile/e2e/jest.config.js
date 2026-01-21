module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.e2e.ts'],
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: [
    'detox/runners/jest/reporter',
    ['jest-junit', {
      outputDirectory: 'e2e/test-results',
      outputName: 'junit.xml',
    }],
  ],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
};
