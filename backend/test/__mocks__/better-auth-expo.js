// Jest mock for '@better-auth/expo' (ESM → CJS stub for unit tests)
'use strict';

module.exports = {
  expo: jest.fn(() => ({ id: 'expo' })),
};
