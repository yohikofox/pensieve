/**
 * DTO pour upsert d'une assignation de feature flag
 * Story 24.2: Feature Flag System — Admin API & Interface d'Administration (AC2/AC3/AC4)
 */
import { IsBoolean } from 'class-validator';

export class UpsertFeatureAssignmentDto {
  @IsBoolean()
  value!: boolean;
}
