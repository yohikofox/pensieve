import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { RgpdService } from './rgpd.service';
import { SupabaseAdminService } from './supabase-admin.service';
import { User } from '../../../shared/infrastructure/persistence/typeorm/entities/user.entity';
import { AuditLog } from '../../../shared/infrastructure/persistence/typeorm/entities/audit-log.entity';

// Mock fs-extra
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  writeJson: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
}));

// Mock AdmZip
jest.mock('adm-zip', () => {
  return jest.fn().mockImplementation(() => ({
    addLocalFolder: jest.fn(),
    toBuffer: jest.fn().mockReturnValue(Buffer.from('mock-zip-content')),
  }));
});

import * as fs from 'fs-extra';

describe('RgpdService', () => {
  let service: RgpdService;
  let userRepository: Repository<User>;
  let auditLogRepository: Repository<AuditLog>;
  let supabaseAdminService: SupabaseAdminService;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  beforeEach(async () => {
    // Mock QueryRunner
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as any;

    // Mock DataSource
    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RgpdService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            save: jest.fn(),
          },
        },
        {
          provide: SupabaseAdminService,
          useValue: {
            getUserProfile: jest.fn(),
            deleteUser: jest.fn(),
            verifyPassword: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<RgpdService>(RgpdService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    auditLogRepository = module.get<Repository<AuditLog>>(
      getRepositoryToken(AuditLog),
    );
    supabaseAdminService = module.get<SupabaseAdminService>(
      SupabaseAdminService,
    );
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateExport', () => {
    const userId = 'test-user-123';
    const mockRequest = {
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
    } as any;

    it('should generate export ZIP with all user data', async () => {
      // Arrange
      const mockUserProfile = {
        id: userId,
        email: 'test@example.com',
        created_at: '2026-01-01T00:00:00Z',
      };

      jest
        .spyOn(supabaseAdminService, 'getUserProfile')
        .mockResolvedValue(mockUserProfile);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        status: 'active',
      } as User);
      jest.spyOn(auditLogRepository, 'save').mockResolvedValue({} as AuditLog);

      // Act
      const result = await service.generateExport(userId, mockRequest);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(supabaseAdminService.getUserProfile).toHaveBeenCalledWith(userId);
      expect(auditLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          action: 'RGPD_EXPORT_REQUESTED',
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla/5.0',
        }),
      );
    });

    it('should upsert user before generating export', async () => {
      // Arrange
      const mockUserProfile = {
        id: userId,
        email: 'test@example.com',
        created_at: '2026-01-01T00:00:00Z',
      };

      jest
        .spyOn(supabaseAdminService, 'getUserProfile')
        .mockResolvedValue(mockUserProfile);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(userRepository, 'create').mockReturnValue({
        id: userId,
        email: 'test@example.com',
        status: 'active',
      } as User);
      jest.spyOn(userRepository, 'save').mockResolvedValue({} as User);
      jest.spyOn(auditLogRepository, 'save').mockResolvedValue({} as AuditLog);

      // Act
      await service.generateExport(userId, mockRequest);

      // Assert
      expect(userRepository.create).toHaveBeenCalledWith({
        id: userId,
        email: 'test@example.com',
        status: 'active',
      });
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should cleanup temp files on error', async () => {
      // Arrange
      jest
        .spyOn(supabaseAdminService, 'getUserProfile')
        .mockRejectedValue(new Error('Supabase error'));

      // Act & Assert
      await expect(
        service.generateExport(userId, mockRequest),
      ).rejects.toThrow('Supabase error');
      expect(fs.remove).toHaveBeenCalled();
    });

    it('should include audit metadata (file size)', async () => {
      // Arrange
      const mockUserProfile = {
        id: userId,
        email: 'test@example.com',
        created_at: '2026-01-01T00:00:00Z',
      };

      jest
        .spyOn(supabaseAdminService, 'getUserProfile')
        .mockResolvedValue(mockUserProfile);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({} as User);
      const auditSaveSpy = jest
        .spyOn(auditLogRepository, 'save')
        .mockResolvedValue({} as AuditLog);

      // Act
      await service.generateExport(userId, mockRequest);

      // Assert
      expect(auditSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            file_size: expect.any(Number),
          }),
        }),
      );
    });
  });

  describe('deleteUserAccount', () => {
    const userId = 'test-user-123';
    const mockRequest = {
      ip: '192.168.1.1',
      get: jest.fn().mockReturnValue('Mobile App'),
    } as any;

    it('should delete user account in correct order', async () => {
      // Arrange
      jest.spyOn(auditLogRepository, 'save').mockResolvedValue({} as AuditLog);
      jest
        .spyOn(supabaseAdminService, 'deleteUser')
        .mockResolvedValue(undefined);

      // Act
      await service.deleteUserAccount(userId, mockRequest);

      // Assert
      expect(queryRunner.connect).toHaveBeenCalled();
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(auditLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          action: 'RGPD_ACCOUNT_DELETED',
        }),
      );
      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        User,
        userId,
        expect.objectContaining({
          status: 'deletion_pending',
        }),
      );
      expect(queryRunner.manager.delete).toHaveBeenCalledWith(User, {
        id: userId,
      });
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(supabaseAdminService.deleteUser).toHaveBeenCalledWith(userId);
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      // Arrange
      jest.spyOn(auditLogRepository, 'save').mockResolvedValue({} as AuditLog);
      jest
        .spyOn(queryRunner.manager, 'delete')
        .mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(
        service.deleteUserAccount(userId, mockRequest),
      ).rejects.toThrow('Database error');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should still call Supabase delete even if PostgreSQL succeeds', async () => {
      // Arrange
      jest.spyOn(auditLogRepository, 'save').mockResolvedValue({} as AuditLog);
      const supabaseDeleteSpy = jest
        .spyOn(supabaseAdminService, 'deleteUser')
        .mockResolvedValue(undefined);

      // Act
      await service.deleteUserAccount(userId, mockRequest);

      // Assert
      expect(supabaseDeleteSpy).toHaveBeenCalledWith(userId);
    });

    it('should log audit entry before deletion', async () => {
      // Arrange
      const auditSaveSpy = jest
        .spyOn(auditLogRepository, 'save')
        .mockResolvedValue({} as AuditLog);
      jest
        .spyOn(supabaseAdminService, 'deleteUser')
        .mockResolvedValue(undefined);

      // Act
      await service.deleteUserAccount(userId, mockRequest);

      // Assert
      expect(auditSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          action: 'RGPD_ACCOUNT_DELETED',
          ip_address: '192.168.1.1',
          user_agent: 'Mobile App',
          metadata: expect.objectContaining({
            deleted_at: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('verifyPassword', () => {
    it('should call SupabaseAdminService to verify password', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'SecurePassword123';
      jest
        .spyOn(supabaseAdminService, 'verifyPassword')
        .mockResolvedValue(true);

      // Act
      const result = await service.verifyPassword(email, password);

      // Assert
      expect(result).toBe(true);
      expect(supabaseAdminService.verifyPassword).toHaveBeenCalledWith(
        email,
        password,
      );
    });

    it('should return false for invalid password', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'WrongPassword';
      jest
        .spyOn(supabaseAdminService, 'verifyPassword')
        .mockResolvedValue(false);

      // Act
      const result = await service.verifyPassword(email, password);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('upsertUser', () => {
    it('should create new user if not exists', async () => {
      // Arrange
      const userId = 'new-user-123';
      const email = 'newuser@example.com';
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(userRepository, 'create').mockReturnValue({
        id: userId,
        email,
        status: 'active',
      } as User);
      jest.spyOn(userRepository, 'save').mockResolvedValue({} as User);

      // Act
      await service.upsertUser(userId, email);

      // Assert
      expect(userRepository.create).toHaveBeenCalledWith({
        id: userId,
        email,
        status: 'active',
      });
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should return existing user if already exists', async () => {
      // Arrange
      const userId = 'existing-user-123';
      const email = 'existing@example.com';
      const existingUser = {
        id: userId,
        email,
        status: 'active',
      } as User;
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(existingUser);
      jest.spyOn(userRepository, 'create');
      jest.spyOn(userRepository, 'save');

      // Act
      const result = await service.upsertUser(userId, email);

      // Assert
      expect(result).toEqual(existingUser);
      expect(userRepository.create).not.toHaveBeenCalled();
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });
});
