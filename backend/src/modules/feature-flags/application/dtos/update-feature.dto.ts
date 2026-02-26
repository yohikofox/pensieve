/**
 * DTO pour la modification d'une feature (key immuable)
 * Story 24.2: Feature Flag System — Admin API & Interface d'Administration (AC1)
 */
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateFeatureDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  defaultValue?: boolean;
}
