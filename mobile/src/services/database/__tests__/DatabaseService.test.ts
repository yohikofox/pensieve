/**
 * DatabaseService Tests
 * Story 4.4: Task 6.5 - Local persistence with OP-SQLite
 */

import { DatabaseService } from '../DatabaseService';
import { open, type DB } from '@op-engineering/op-sqlite';

// Mock OP-SQLite
jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(),
}));

describe('DatabaseService', () => {
  let service: DatabaseService;
  let mockDB: jest.Mocked<DB>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock database
    mockDB = {
      execute: jest.fn().mockReturnValue({ rows: [] }),
      close: jest.fn(),
    } as any;

    (open as jest.Mock).mockReturnValue(mockDB);

    // Get fresh instance (singleton)
    service = DatabaseService.getInstance();
  });

  afterEach(() => {
    // Close database after each test
    service.close();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = DatabaseService.getInstance();
      const instance2 = DatabaseService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should open database with correct name', async () => {
      await service.initialize();

      expect(open).toHaveBeenCalledWith({ name: 'pensieve.sqlite' });
    });

    it('should create migrations table', async () => {
      await service.initialize();

      // Check migrations table was created
      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS migrations')
      );
    });

    it('should run notification preferences migration', async () => {
      await service.initialize();

      // Check notification_preferences table was created
      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS notification_preferences')
      );

      // Check default row was inserted
      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR IGNORE INTO notification_preferences')
      );
    });

    it('should not reinitialize if already initialized', async () => {
      await service.initialize();
      jest.clearAllMocks();

      await service.initialize();

      expect(open).not.toHaveBeenCalled();
    });

    it('should record migration in migrations table', async () => {
      // Mock migration not applied yet
      mockDB.execute.mockReturnValueOnce({ rows: [] } as any); // migrations table check
      mockDB.execute.mockReturnValueOnce({ rows: [] } as any); // migration check (not found)

      await service.initialize();

      // Check migration was recorded
      expect(mockDB.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO migrations'),
        expect.arrayContaining(['001_create_notification_preferences'])
      );
    });

    it('should skip migration if already applied', async () => {
      // Mock migration already applied
      mockDB.execute
        .mockReturnValueOnce({ rows: [] } as any) // migrations table check
        .mockReturnValueOnce({ rows: { length: 1, item: jest.fn() } } as any); // migration check (found)

      await service.initialize();

      // Migration should not be recorded again
      expect(mockDB.execute).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO migrations'),
        expect.arrayContaining(['001_create_notification_preferences'])
      );
    });

    it('should throw error if database fails to open', async () => {
      (open as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Failed to open database');
      });

      await expect(service.initialize()).rejects.toThrow('Failed to open database');
    });
  });

  describe('getDB', () => {
    it('should return database instance after initialization', async () => {
      await service.initialize();
      const db = service.getDB();
      expect(db).toBe(mockDB);
    });

    it('should throw error if not initialized', () => {
      expect(() => service.getDB()).toThrow('Database not initialized. Call initialize() first.');
    });
  });

  describe('close', () => {
    it('should close database connection', async () => {
      await service.initialize();
      service.close();

      expect(mockDB.close).toHaveBeenCalled();
    });

    it('should allow getting DB to throw after close', async () => {
      await service.initialize();
      service.close();

      expect(() => service.getDB()).toThrow('Database not initialized');
    });
  });
});
