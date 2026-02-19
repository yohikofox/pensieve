// Jest mock for 'better-auth/crypto'
'use strict';

module.exports = {
  hashPassword: jest.fn().mockResolvedValue('$mock$hashed$password'),
  verifyPassword: jest.fn().mockResolvedValue(false),
  generateRandomString: jest.fn().mockReturnValue('mock-random-string'),
};
