import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../shared/infrastructure/persistence/typeorm/entities/user.entity';
import { UserFeaturesDto } from '../dtos/user-features.dto';

/**
 * Service for managing user feature flags/permissions
 * Story 7.1: Support Mode avec Permissions Backend
 */
@Injectable()
export class UserFeaturesService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Get user feature flags/permissions
   * @param userId - Better Auth user ID
   * @returns UserFeaturesDto with current feature flags
   * @throws NotFoundException if user not found
   */
  async getUserFeatures(userId: string): Promise<UserFeaturesDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'debug_mode_access', 'data_mining_access'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const dto = new UserFeaturesDto();
    dto.debug_mode_access = user.debug_mode_access;
    dto.data_mining_access = user.data_mining_access;

    return dto;
  }

  /**
   * Update user feature flags (admin action — partial PATCH)
   * Used by admin interface
   * @param userId - Better Auth user ID
   * @param patch - Partial feature flags to update
   * @returns Updated UserFeaturesDto
   * @throws NotFoundException if user not found
   */
  async updateFeatures(
    userId: string,
    patch: { debug_mode_access?: boolean; data_mining_access?: boolean },
  ): Promise<UserFeaturesDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (patch.debug_mode_access !== undefined) {
      user.debug_mode_access = patch.debug_mode_access;
    }
    if (patch.data_mining_access !== undefined) {
      user.data_mining_access = patch.data_mining_access;
    }

    await this.userRepository.save(user);

    return this.getUserFeatures(userId);
  }

  /**
   * @deprecated Use updateFeatures() instead
   */
  async updateDebugModeAccess(
    userId: string,
    debugModeAccess: boolean,
  ): Promise<UserFeaturesDto> {
    return this.updateFeatures(userId, { debug_mode_access: debugModeAccess });
  }
}
