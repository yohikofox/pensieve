/**
 * DTO pour la création d'une feature dans le catalogue
 * Story 24.2: Feature Flag System — Admin API & Interface d'Administration (AC1)
 */
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFeatureDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  defaultValue?: boolean;
}
