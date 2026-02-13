import {
  IsOptional,
  IsNumber,
  IsString,
  IsUUID,
  IsBoolean,
  IsDate,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for pagination queries
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * DTO for assigning a role to a user
 */
export class AssignRoleDto {
  @IsUUID()
  roleId!: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;
}

/**
 * DTO for granting/denying a permission to a user
 */
export class GrantPermissionDto {
  @IsUUID()
  permissionId!: string;

  @IsBoolean()
  granted!: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;
}

/**
 * DTO for creating a subscription tier
 */
export class CreateTierDto {
  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  priceMonthly!: number;

  @IsBoolean()
  isActive!: boolean;

  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds!: string[];
}

/**
 * DTO for updating a subscription tier
 */
export class UpdateTierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMonthly?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}

/**
 * DTO for creating a role
 */
export class CreateRoleDto {
  @IsString()
  name!: string;

  @IsString()
  displayName!: string;

  @IsBoolean()
  isSystemRole!: boolean;

  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds!: string[];
}

/**
 * DTO for updating a role
 */
export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}

/**
 * DTO for assigning permissions to a role
 */
export class AssignRolePermissionsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds!: string[];
}

/**
 * DTO for assigning permissions to a tier
 */
export class AssignTierPermissionsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds!: string[];
}
