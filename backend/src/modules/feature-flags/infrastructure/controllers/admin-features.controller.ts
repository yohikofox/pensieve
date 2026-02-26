import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtGuard } from '../../../admin-auth/infrastructure/guards/admin-jwt.guard';
import { AdminFeatureFlagsService } from '../../application/services/admin-feature-flags.service';
import { CreateFeatureDto } from '../../application/dtos/create-feature.dto';
import { UpdateFeatureDto } from '../../application/dtos/update-feature.dto';
import { Feature } from '../../domain/entities/feature.entity';

/**
 * AdminFeaturesController — API admin pour le catalogue de feature flags
 * Story 24.2: Feature Flag System — Admin API & Interface d'Administration (AC1, AC7)
 *
 * GET    /api/admin/features        — liste complète du catalogue
 * POST   /api/admin/features        — créer une feature
 * PATCH  /api/admin/features/:id    — modifier description / default_value (key immuable)
 *
 * Tous les endpoints sont protégés par AdminJwtGuard (AC7).
 */
@Controller('api/admin/features')
@UseGuards(AdminJwtGuard)
export class AdminFeaturesController {
  private readonly logger = new Logger(AdminFeaturesController.name);

  constructor(private readonly adminService: AdminFeatureFlagsService) {}

  @Get()
  listFeatures(): Promise<Feature[]> {
    this.logger.log('Admin listing feature catalogue');
    return this.adminService.listFeatures();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createFeature(@Body() dto: CreateFeatureDto): Promise<Feature> {
    this.logger.log(`Admin creating feature: ${dto.key}`);
    return this.adminService.createFeature(dto);
  }

  @Patch(':id')
  updateFeature(
    @Param('id') id: string,
    @Body() dto: UpdateFeatureDto,
  ): Promise<Feature> {
    this.logger.log(`Admin updating feature ${id}`);
    return this.adminService.updateFeature(id, dto);
  }
}
