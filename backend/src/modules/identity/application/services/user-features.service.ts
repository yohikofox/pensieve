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
   * @param userId - Supabase user ID
   * @returns UserFeaturesDto with current feature flags
   * @throws NotFoundException if user not found
   */
  async getUserFeatures(userId: string): Promise<UserFeaturesDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'debug_mode_access'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const dto = new UserFeaturesDto();
    dto.debug_mode_access = user.debug_mode_access;

    return dto;
  }

  /**
   * Update user's debug_mode_access permission
   * Used by admin interface (Task 2)
   * @param userId - Supabase user ID
   * @param debugModeAccess - New value for debug_mode_access
   * @returns Updated UserFeaturesDto
   * @throws NotFoundException if user not found
   */
  async updateDebugModeAccess(
    userId: string,
    debugModeAccess: boolean,
  ): Promise<UserFeaturesDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.debug_mode_access = debugModeAccess;
    await this.userRepository.save(user);

    const dto = new UserFeaturesDto();
    dto.debug_mode_access = user.debug_mode_access;

    return dto;
  }
}
