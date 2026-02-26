import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../../../shared/infrastructure/persistence/typeorm/entities/user.entity';
import { UserFeaturesDto } from '../dtos/user-features.dto';
import { FeatureResolutionService } from '../../../feature-flags/application/services/feature-resolution.service';

/**
 * Service de lecture et mise à jour des feature flags utilisateur
 * Story 24.1: Feature Flag System — Adaptation du service existant (AC5)
 *
 * getUserFeatures() délègue à FeatureResolutionService (algorithme deny-wins).
 * updateFeatures() écrit dans user_feature_assignments (bridge pour Story 24.2).
 */
@Injectable()
export class UserFeaturesService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly featureResolutionService: FeatureResolutionService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Résout les feature flags pour un utilisateur.
   * @throws NotFoundException si l'utilisateur n'existe pas
   */
  async getUserFeatures(userId: string): Promise<UserFeaturesDto> {
    const exists = await this.userRepository.existsBy({ id: userId });
    if (!exists) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return this.featureResolutionService.resolveFeatures(userId);
  }

  /**
   * Met à jour les assignations de feature flags via les clés legacy.
   * Bridge pour l'admin jusqu'à Story 24.2.
   *
   * Mapping : debug_mode_access → 'debug_mode', data_mining_access → 'data_mining'
   *
   * @throws NotFoundException si l'utilisateur n'existe pas
   */
  async updateFeatures(
    userId: string,
    patch: { debug_mode_access?: boolean; data_mining_access?: boolean },
  ): Promise<UserFeaturesDto> {
    const exists = await this.userRepository.existsBy({ id: userId });
    if (!exists) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const keyMap: Record<string, string> = {
      debug_mode_access: 'debug_mode',
      data_mining_access: 'data_mining',
    };

    for (const [legacyKey, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      const featureKey = keyMap[legacyKey];
      if (!featureKey) continue;

      await this.dataSource.query(
        `INSERT INTO user_feature_assignments (user_id, feature_id, value, created_at)
         SELECT $1, f.id, $2, NOW()
         FROM features f
         WHERE f.key = $3
         ON CONFLICT (user_id, feature_id) DO UPDATE SET value = $2`,
        [userId, value, featureKey],
      );
    }

    return this.getUserFeatures(userId);
  }
}
