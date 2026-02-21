// Jest mock for 'better-auth/plugins'
'use strict';

module.exports = {
  admin: jest.fn(() => ({})),
  bearer: jest.fn(() => ({})),
  customSession: jest.fn((fn) => ({ id: 'custom-session', _fn: fn })),
};
