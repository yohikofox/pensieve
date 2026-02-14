import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { UserFeaturesService } from './user-features.service';
import { User } from '../../../shared/infrastructure/persistence/typeorm/entities/user.entity';
import { UserFeaturesDto } from '../dtos/user-features.dto';

describe('UserFeaturesService', () => {
  let service: UserFeaturesService;
  let userRepository: Repository<User>;

  const mockUser: Partial<User> = {
    id: 'test-user-id',
    email: 'test@example.com',
    status: 'active',
    debug_mode_access: false,
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserFeaturesService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UserFeaturesService>(UserFeaturesService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserFeatures', () => {
    it('should return debug_mode_access as false by default', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getUserFeatures('test-user-id');

      expect(result).toBeInstanceOf(UserFeaturesDto);
      expect(result.debug_mode_access).toBe(false);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-user-id' },
        select: ['id', 'debug_mode_access'],
      });
    });

    it('should return debug_mode_access as true when enabled', async () => {
      const userWithDebugEnabled = { ...mockUser, debug_mode_access: true };
      mockUserRepository.findOne.mockResolvedValue(userWithDebugEnabled);

      const result = await service.getUserFeatures('test-user-id');

      expect(result.debug_mode_access).toBe(true);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.getUserFeatures('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getUserFeatures('non-existent-id')).rejects.toThrow(
        'User with ID non-existent-id not found',
      );
    });
  });

  describe('updateDebugModeAccess', () => {
    it('should update debug_mode_access to true', async () => {
      const updatedUser = { ...mockUser, debug_mode_access: true };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateDebugModeAccess('test-user-id', true);

      expect(result.debug_mode_access).toBe(true);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should update debug_mode_access to false', async () => {
      const userWithDebugEnabled = { ...mockUser, debug_mode_access: true };
      const updatedUser = { ...mockUser, debug_mode_access: false };
      mockUserRepository.findOne.mockResolvedValue(userWithDebugEnabled);
      mockUserRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateDebugModeAccess('test-user-id', false);

      expect(result.debug_mode_access).toBe(false);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateDebugModeAccess('non-existent-id', true),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateDebugModeAccess('non-existent-id', true),
      ).rejects.toThrow('User with ID non-existent-id not found');
    });
  });
});
