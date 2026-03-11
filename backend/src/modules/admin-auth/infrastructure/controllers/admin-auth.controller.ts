import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AdminAuthService } from '../../application/services/admin-auth.service';
import {
  LoginAdminDto,
  ChangePasswordDto,
  CreateAdminDto,
} from '../../application/dtos/admin-auth.dto';
import { AdminGuard } from '../guards/admin.guard';

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
  @UseGuards(AdminGuard)
  async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    await this.adminAuthService.changePassword(req.user.email, dto);
    this.logger.log(`Admin ${req.user.email} changed password`);
    return { message: 'Password changed successfully' };
  }

  /**
   * Create a new admin (requires super admin)
   * POST /api/auth/admin/create
   * Requires AdminGuard + isSuperAdmin
   */
  @Post('create')
  @UseGuards(AdminGuard)
  async createAdmin(@Request() req: any, @Body() dto: CreateAdminDto) {
    const currentAdmin = await this.adminAuthService.getByEmail(req.user.email);
    if (!currentAdmin) throw new NotFoundException('Admin not found');
    if (!currentAdmin.isSuperAdmin) {
      throw new ForbiddenException('Only super admins can create new admins');
    }

    const admin = await this.adminAuthService.createAdmin(dto);
    this.logger.log(
      `Super admin ${req.user.email} created admin ${admin.email}`,
    );

    return {
      message: 'Admin created successfully',
      admin: { id: admin.id, email: admin.email, name: admin.name },
    };
  }

  /**
   * Get current admin info
   * GET /api/auth/admin/me
   * Requires AdminGuard
   */
  @Get('me')
  @UseGuards(AdminGuard)
  async getCurrentAdmin(@Request() req: any) {
    const admin = await this.adminAuthService.getByEmail(req.user.email);
    if (!admin) throw new NotFoundException('Admin not found');
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      isSuperAdmin: admin.isSuperAdmin,
      mustChangePassword: admin.mustChangePassword,
    };
  }
}
