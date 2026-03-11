import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Pool } from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { AdminUserRepository } from '../repositories/admin-user.repository';
import { AdminUser } from '../../domain/entities/admin-user.entity';
import {
  LoginAdminDto,
  ChangePasswordDto,
  CreateAdminDto,
} from '../dtos/admin-auth.dto';

const BCRYPT_ROUNDS = 10;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly adminUserRepo: AdminUserRepository,
    @Inject('BETTER_AUTH_POOL') private readonly pool: Pool,
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

    const betterAuthUserId = await this.upsertBetterAuthUser(admin);
    const accessToken = await this.createBetterAuthSession(betterAuthUserId);

    return { accessToken, admin };
  }

  /**
   * Upserte l'utilisateur dans la table Better Auth avec role='admin'.
   * Crée l'entrée si elle n'existe pas, met à jour le rôle si elle existe.
   */
  private async upsertBetterAuthUser(admin: AdminUser): Promise<string> {
    const now = new Date();
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role)
       VALUES ($1, $2, $3, true, $4, $4, 'admin')
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name, role = 'admin', "updatedAt" = EXCLUDED."updatedAt"
       RETURNING id`,
      [uuidv7(), admin.name, admin.email, now],
    );
    return result.rows[0].id;
  }

  /**
   * Crée une session Better Auth et retourne le token de session.
   * Ce token peut être utilisé comme Bearer token (plugin bearer()).
   */
  private async createBetterAuthSession(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

    await this.pool.query(
      `INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "userId")
       VALUES ($1, $2, $3, $4, $4, $5)`,
      [uuidv7(), expiresAt, token, now, userId],
    );

    return token;
  }

  async getByEmail(email: string): Promise<AdminUser | null> {
    return this.adminUserRepo.findByEmail(email);
  }

  async changePassword(email: string, dto: ChangePasswordDto): Promise<void> {
    const admin = await this.adminUserRepo.findByEmail(email);
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

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }
}
