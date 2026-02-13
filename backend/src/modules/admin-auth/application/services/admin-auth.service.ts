import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminUserRepository } from '../repositories/admin-user.repository';
import { AdminUser } from '../../domain/entities/admin-user.entity';
import {
  LoginAdminDto,
  ChangePasswordDto,
  CreateAdminDto,
} from '../dtos/admin-auth.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly adminUserRepo: AdminUserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    dto: LoginAdminDto,
  ): Promise<{ accessToken: string; admin: AdminUser }> {
    const admin = await this.adminUserRepo.findByEmail(dto.email);
    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      admin.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: admin.id,
      email: admin.email,
      isSuperAdmin: admin.isSuperAdmin,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken, admin };
  }

  async changePassword(adminId: string, dto: ChangePasswordDto): Promise<void> {
    const admin = await this.adminUserRepo.findOne({ where: { id: adminId } });
    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    const isOldPasswordValid = await bcrypt.compare(
      dto.oldPassword,
      admin.passwordHash,
    );
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Invalid old password');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    admin.passwordHash = newPasswordHash;
    admin.mustChangePassword = false;
    await this.adminUserRepo.save(admin);
  }

  async createAdmin(dto: CreateAdminDto): Promise<AdminUser> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const admin = this.adminUserRepo.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      isSuperAdmin: false,
      mustChangePassword: true,
    });

    return this.adminUserRepo.save(admin);
  }

  async validateToken(token: string): Promise<AdminUser | null> {
    try {
      const payload = await this.jwtService.verifyAsync(token);
      return this.adminUserRepo.findOne({ where: { id: payload.sub } });
    } catch {
      return null;
    }
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }
}
