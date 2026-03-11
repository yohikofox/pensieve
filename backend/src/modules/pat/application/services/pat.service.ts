import * as crypto from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { PersonalAccessToken } from '../../domain/entities/personal-access-token.entity';
import { PatRepository } from '../../infrastructure/repositories/pat.repository';
import { VALID_SCOPES } from '../../infrastructure/guards/pat-scopes';
import type { CreatePatDto } from '../dto/create-pat.dto';
import type { UpdatePatDto } from '../dto/update-pat.dto';
import type { RenewPatDto } from '../dto/renew-pat.dto';
import { PATAuditService } from './pat-audit.service';
import { PATAuditLog } from '../../domain/entities/pat-audit-log.entity';

export interface AuditInfo {
  adminId: string;
}

export interface PatPublicView {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

function toPublicView(pat: PersonalAccessToken): PatPublicView {
  return {
    id: pat.id,
    userId: pat.userId,
    name: pat.name,
    prefix: pat.prefix,
    scopes: pat.scopes,
    expiresAt: pat.expiresAt,
    lastUsedAt: pat.lastUsedAt,
    revokedAt: pat.revokedAt,
    createdAt: pat.createdAt,
  };
}

@Injectable()
export class PatService {
  constructor(
    private readonly patRepository: PatRepository,
    private readonly dataSource: DataSource,
    private readonly patAuditService: PATAuditService,
  ) {}

  async generate(
    userId: string,
    dto: CreatePatDto,
    auditInfo?: AuditInfo,
  ): Promise<{ pat: PatPublicView; token: string }> {
    const invalidScopes = dto.scopes.filter(
      (s) => !(VALID_SCOPES as readonly string[]).includes(s),
    );
    if (invalidScopes.length > 0) {
      throw new BadRequestException(
        `Scopes invalides : ${invalidScopes.join(', ')}`,
      );
    }

    const raw = crypto.randomBytes(32).toString('base64url');
    const token = `pns_${raw}`;
    const prefix = token.slice(0, 12);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dto.expiresInDays);

    const pat = new PersonalAccessToken();
    pat.id = uuidv7();
    pat.userId = userId;
    pat.name = dto.name;
    pat.tokenHash = tokenHash;
    pat.prefix = prefix;
    pat.scopes = dto.scopes;
    pat.expiresAt = expiresAt;

    const saved = await this.patRepository.save(pat);

    if (auditInfo) {
      await this.patAuditService.log(
        auditInfo.adminId,
        userId,
        saved.id,
        'create',
      );
    }

    return { pat: toPublicView(saved), token };
  }

  async findAll(userId: string): Promise<PatPublicView[]> {
    const pats = await this.patRepository.findByUserId(userId);
    return pats.map(toPublicView);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdatePatDto,
  ): Promise<PatPublicView> {
    const pat = await this.patRepository.findByIdAndUserId(id, userId);
    if (!pat) {
      throw new NotFoundException(`PAT ${id} introuvable`);
    }

    if (dto.name !== undefined) pat.name = dto.name;
    if (dto.scopes !== undefined) {
      const invalidScopes = dto.scopes.filter(
        (s) => !(VALID_SCOPES as readonly string[]).includes(s),
      );
      if (invalidScopes.length > 0) {
        throw new BadRequestException(
          `Scopes invalides : ${invalidScopes.join(', ')}`,
        );
      }
      pat.scopes = dto.scopes;
    }

    const updated = await this.patRepository.update(pat);
    return toPublicView(updated);
  }

  async renew(
    id: string,
    userId: string,
    dto: RenewPatDto,
    auditInfo?: AuditInfo,
  ): Promise<{ pat: PatPublicView; token: string }> {
    const existing = await this.patRepository.findByIdAndUserId(id, userId);
    if (!existing) {
      throw new NotFoundException(`PAT ${id} introuvable`);
    }

    const raw = crypto.randomBytes(32).toString('base64url');
    const token = `pns_${raw}`;
    const prefix = token.slice(0, 12);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const expiresInDays = dto.expiresInDays ?? 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Révoquer l'ancien PAT
      existing.revokedAt = new Date();
      await queryRunner.manager.save(existing);

      // Créer le nouveau PAT
      const newPat = new PersonalAccessToken();
      newPat.id = uuidv7();
      newPat.userId = userId;
      newPat.name = existing.name;
      newPat.tokenHash = tokenHash;
      newPat.prefix = prefix;
      newPat.scopes = existing.scopes;
      newPat.expiresAt = expiresAt;

      const saved = await queryRunner.manager.save(newPat);

      // Audit dans la transaction : garantit qu'il n'y a pas de rotation sans trace
      if (auditInfo) {
        const auditEntry = new PATAuditLog();
        auditEntry.id = uuidv7();
        auditEntry.adminId = auditInfo.adminId;
        auditEntry.userId = userId;
        auditEntry.patId = saved.id;
        auditEntry.action = 'renew';
        await queryRunner.manager.insert(PATAuditLog, auditEntry);
      }

      await queryRunner.commitTransaction();

      return { pat: toPublicView(saved), token };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async revoke(
    id: string,
    userId: string,
    auditInfo?: AuditInfo,
  ): Promise<void> {
    const pat = await this.patRepository.findByIdAndUserId(id, userId);
    if (!pat) {
      throw new NotFoundException(`PAT ${id} introuvable`);
    }

    pat.revokedAt = new Date();
    await this.patRepository.update(pat);

    if (auditInfo) {
      await this.patAuditService.log(auditInfo.adminId, userId, id, 'revoke');
    }
  }
}
