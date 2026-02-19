import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../../../shared/infrastructure/persistence/typeorm/entities/user.entity';
import { AuditLog } from '../../../shared/infrastructure/persistence/typeorm/entities/audit-log.entity';
import { BetterAuthAdminService } from './better-auth-admin.service';
import AdmZip from 'adm-zip';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Request } from 'express';

@Injectable()
export class RgpdService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
    private betterAuthAdminService: BetterAuthAdminService,
    private dataSource: DataSource,
  ) {}

  /**
   * Generate user data export (simplified version without audio files)
   */
  async generateExport(userId: string, req: Request): Promise<Buffer> {
    const timestamp = Date.now();
    const exportDir = `/tmp/rgpd-export-${userId}-${timestamp}`;

    try {
      // Create temp directory
      await fs.ensureDir(exportDir);

      // 0. Ensure user exists in PostgreSQL (for audit log foreign key)
      const userProfile =
        await this.betterAuthAdminService.getUserProfile(userId);
      await this.upsertUser(userId, userProfile.email);

      // 1. Fetch user profile from Supabase
      await fs.writeJson(
        path.join(exportDir, 'user-profile.json'),
        {
          export_metadata: {
            export_date: new Date().toISOString(),
            user_id: userId,
            format_version: '1.0',
          },
          user: userProfile,
        },
        { spaces: 2 },
      );

      // 2. Fetch user from PostgreSQL (if exists)
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (user) {
        await fs.writeJson(
          path.join(exportDir, 'user-data.json'),
          { user },
          { spaces: 2 },
        );
      }

      // 3. Create README
      await fs.writeFile(
        path.join(exportDir, 'README.txt'),
        `
Pensine - Export de vos données personnelles
Date: ${new Date().toISOString()}
User ID: ${userId}

Ce fichier ZIP contient toutes vos données personnelles conformément à l'Article 15 du RGPD.

Contenu:
- user-profile.json: Profil utilisateur (Supabase)
- user-data.json: Données applicatives (PostgreSQL)

Pour toute question, contactez: support@pensine.app
        `.trim(),
      );

      // 4. Create ZIP archive
      const zip = new AdmZip();
      zip.addLocalFolder(exportDir);
      const zipBuffer = zip.toBuffer();

      // 5. Audit log
      await this.auditLogRepo.save({
        user_id: userId,
        action: 'RGPD_EXPORT_REQUESTED',
        timestamp: new Date(),
        ip_address: req.ip || null,
        user_agent: req.get('user-agent') || null,
        metadata: {
          file_size: zipBuffer.length,
        },
      });

      // 6. Cleanup temp files
      await fs.remove(exportDir);

      return zipBuffer;
    } catch (error) {
      // Cleanup on error
      await fs.remove(exportDir);
      throw error;
    }
  }

  /**
   * Delete user account and all associated data
   *
   * Order is critical:
   * 1. Audit log (before deletion)
   * 2. PostgreSQL data deletion (CASCADE)
   * 3. Supabase auth user deletion
   */
  async deleteUserAccount(userId: string, req: Request): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create audit log entry (BEFORE deletion)
      const auditEntry = {
        user_id: userId,
        action: 'RGPD_ACCOUNT_DELETED' as const,
        timestamp: new Date(),
        ip_address: req.ip || null,
        user_agent: req.get('user-agent') || null,
        metadata: {
          deleted_at: new Date().toISOString(),
        },
      };
      await this.auditLogRepo.save(auditEntry);

      // 2. Mark user as deletion_pending
      await queryRunner.manager.update(User, userId, {
        status: 'deletion_pending',
        deletion_requested_at: new Date(),
      });

      // 3. Delete PostgreSQL data (CASCADE will handle related records)
      // For now, just delete the user (audit logs are kept for legal reasons)
      await queryRunner.manager.delete(User, { id: userId });

      await queryRunner.commitTransaction();

      // 4. Delete Supabase auth user (Admin API)
      await this.betterAuthAdminService.deleteUser(userId);

      console.log(`✅ Account deleted successfully: ${userId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error(`❌ Account deletion failed: ${userId}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Verify user password (for account deletion confirmation)
   */
  async verifyPassword(email: string, password: string): Promise<boolean> {
    return await this.betterAuthAdminService.verifyPassword(email, password);
  }

  /**
   * Create or update user in PostgreSQL (called from auth guard/interceptor)
   */
  async upsertUser(userId: string, email: string): Promise<User> {
    let user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      user = this.userRepo.create({
        id: userId,
        email,
        status: 'active',
      });
      await this.userRepo.save(user);
    }

    return user;
  }

  /**
   * Sync all Supabase Auth users → backend PostgreSQL (descending sync)
   *
   * Match strategy: email is the stable identifier.
   * - If match by id → update email if changed.
   * - If match by email (different id) → overwrite id via raw SQL + update email.
   * - If no match → create new record.
   *
   * Note: to be migrated to Better Auth provider sync when Epic 15 is implemented.
   */
  async syncUsersFromSupabase(): Promise<{
    created: number;
    updated: number;
    unchanged: number;
  }> {
    const betterAuthUsers = await this.betterAuthAdminService.listAllUsers();

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const betterAuthUser of betterAuthUsers) {
      const { id, email } = betterAuthUser;

      // 1. Try match by provider id (Supabase UUID)
      const byId = await this.userRepo.findOne({ where: { id } });
      if (byId) {
        if (byId.email !== email) {
          await this.userRepo.update({ id }, { email });
          updated++;
        } else {
          unchanged++;
        }
        continue;
      }

      // 2. Try match by email (user may exist with different provider id)
      const byEmail = await this.userRepo.findOne({ where: { email } });
      if (byEmail) {
        // Overwrite provider id and email via raw SQL (PK update)
        await this.userRepo.query(
          'UPDATE users SET id = $1, email = $2 WHERE email = $3',
          [id, email, email],
        );
        updated++;
        continue;
      }

      // 3. No match — create new record
      await this.userRepo.save(
        this.userRepo.create({ id, email, status: 'active' }),
      );
      created++;
    }

    return { created, updated, unchanged };
  }
}
