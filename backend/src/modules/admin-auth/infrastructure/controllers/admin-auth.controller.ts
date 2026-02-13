import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { AdminAuthService } from '../../application/services/admin-auth.service';
import {
  LoginAdminDto,
  ChangePasswordDto,
  CreateAdminDto,
} from '../../application/dtos/admin-auth.dto';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';

@Controller('api/auth/admin')
export class AdminAuthController {
  private readonly logger = new Logger(AdminAuthController.name);

  constructor(private readonly adminAuthService: AdminAuthService) {}

  /**
   * Login with email/password
   * POST /api/auth/admin/login
   */
  @Post('login')
  async login(@Body() dto: LoginAdminDto) {
    this.logger.log(`Admin login attempt: ${dto.email}`);
    const result = await this.adminAuthService.login(dto);

    return {
      accessToken: result.accessToken,
      admin: {
        id: result.admin.id,
        email: result.admin.email,
        name: result.admin.name,
        isSuperAdmin: result.admin.isSuperAdmin,
        mustChangePassword: result.admin.mustChangePassword,
      },
    };
  }

  /**
   * Change password
   * POST /api/auth/admin/change-password
   * Requires JWT
   */
  @Post('change-password')
  @UseGuards(AdminJwtGuard)
  async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    const adminId = req.user.sub;
    await this.adminAuthService.changePassword(adminId, dto);

    this.logger.log(`Admin ${req.user.email} changed password`);

    return { message: 'Password changed successfully' };
  }

  /**
   * Create a new admin (requires super admin)
   * POST /api/auth/admin/create
   * Requires JWT + super admin
   */
  @Post('create')
  @UseGuards(AdminJwtGuard)
  async createAdmin(@Request() req: any, @Body() dto: CreateAdminDto) {
    if (!req.user.isSuperAdmin) {
      throw new Error('Only super admins can create new admins');
    }

    const admin = await this.adminAuthService.createAdmin(dto);

    this.logger.log(
      `Super admin ${req.user.email} created admin ${admin.email}`,
    );

    return {
      message: 'Admin created successfully',
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
    };
  }

  /**
   * Get current admin info
   * GET /api/auth/admin/me
   * Requires JWT
   */
  @Get('me')
  @UseGuards(AdminJwtGuard)
  async getCurrentAdmin(@Request() req: any) {
    return {
      id: req.user.sub,
      email: req.user.email,
      isSuperAdmin: req.user.isSuperAdmin,
    };
  }
}
