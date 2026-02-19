// Jest mock for 'better-auth' (ESM → CJS stub for unit/acceptance tests)
'use strict';

const mockAdminApi = {
  listUsers: jest.fn().mockResolvedValue({ users: [], total: 0 }),
  banUser: jest.fn().mockResolvedValue({ user: null }),
  unbanUser: jest.fn().mockResolvedValue({ user: null }),
  revokeUserSession: jest.fn().mockResolvedValue({ success: true }),
  revokeUserSessions: jest.fn().mockResolvedValue({ success: true }),
};

const mockAuth = {
  api: {
    getSession: jest.fn().mockResolvedValue(null),
    signInEmail: jest.fn().mockResolvedValue(null),
    signUpEmail: jest.fn().mockResolvedValue(null),
    signOut: jest.fn().mockResolvedValue({ success: true }),
    admin: mockAdminApi,
  },
};

module.exports = {
  betterAuth: jest.fn(() => mockAuth),
  __mockAuth: mockAuth,
  __mockAdminApi: mockAdminApi,
};
