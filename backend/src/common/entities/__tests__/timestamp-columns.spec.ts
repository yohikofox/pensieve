/**
 * Story 13.3: Vérification des types de colonnes TIMESTAMPTZ via TypeORM metadata
 *
 * ADR-026 R5: Toutes les colonnes de date doivent utiliser TIMESTAMPTZ.
 *
 * Ces tests vérifient que les métadonnées TypeORM (getMetadataArgsStorage)
 * enregistrent bien le type 'timestamptz' pour les colonnes de date.
 */

import { getMetadataArgsStorage } from 'typeorm';

// Import all entities to trigger decorator registration
import { AppBaseEntity } from '../base.entity';
import { Capture } from '../../../modules/capture/domain/entities/capture.entity';
import { CaptureState } from '../../../modules/capture/domain/entities/capture-state.entity';
import { CaptureType } from '../../../modules/capture/domain/entities/capture-type.entity';
import { CaptureSyncStatus } from '../../../modules/capture/domain/entities/capture-sync-status.entity';
import { Thought } from '../../../modules/knowledge/domain/entities/thought.entity';
import { Idea } from '../../../modules/knowledge/domain/entities/idea.entity';
import { Todo } from '../../../modules/action/domain/entities/todo.entity';
import { Notification } from '../../../modules/notification/domain/entities/Notification.entity';
import { User } from '../../../modules/shared/infrastructure/persistence/typeorm/entities/user.entity';
import { AdminUser } from '../../../modules/admin-auth/domain/entities/admin-user.entity';
import { AuditLog } from '../../../modules/shared/infrastructure/persistence/typeorm/entities/audit-log.entity';
import { SyncLog } from '../../../modules/sync/domain/entities/sync-log.entity';
import { SyncConflict } from '../../../modules/sync/domain/entities/sync-conflict.entity';
import { Role } from '../../../modules/authorization/implementations/postgresql/entities/role.entity';
import { Permission } from '../../../modules/authorization/implementations/postgresql/entities/permission.entity';
import { SubscriptionTier } from '../../../modules/authorization/implementations/postgresql/entities/subscription-tier.entity';
import { UserRole } from '../../../modules/authorization/implementations/postgresql/entities/user-role.entity';
import { UserPermission } from '../../../modules/authorization/implementations/postgresql/entities/user-permission.entity';
import { UserSubscription } from '../../../modules/authorization/implementations/postgresql/entities/user-subscription.entity';
import { ResourceShare } from '../../../modules/authorization/implementations/postgresql/entities/resource-share.entity';

// Force import to register decorators
void AppBaseEntity;

/**
 * Récupère les colonnes de type date/timestamp d'une entité via TypeORM metadata.
 */
const getDateColumnsForEntity = (
  entityClass: new (...args: any[]) => any,
): Array<{ propertyName: string; options: any }> => {
  const storage = getMetadataArgsStorage();
  return storage.columns
    .filter((col) => col.target === entityClass)
    .filter((col) => {
      const type = (col.options as any)?.type;
      return (
        type === 'timestamp' ||
        type === 'timestamptz' ||
        col.mode === 'createDate' ||
        col.mode === 'updateDate' ||
        col.mode === 'deleteDate'
      );
    })
    .map((col) => ({
      propertyName: col.propertyName,
      options: col.options,
    }));
};

describe('Story 13.3: ADR-026 R5 — TIMESTAMPTZ columns compliance', () => {
  describe('AppBaseEntity — Colonnes de date héritées', () => {
    it('createdAt doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const createDateCols = storage.columns.filter(
        (col) =>
          col.target === AppBaseEntity &&
          col.propertyName === 'createdAt' &&
          col.mode === 'createDate',
      );
      expect(createDateCols).toHaveLength(1);
      expect((createDateCols[0].options as any).type).toBe('timestamptz');
    });

    it('updatedAt doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const updateDateCols = storage.columns.filter(
        (col) =>
          col.target === AppBaseEntity &&
          col.propertyName === 'updatedAt' &&
          col.mode === 'updateDate',
      );
      expect(updateDateCols).toHaveLength(1);
      expect((updateDateCols[0].options as any).type).toBe('timestamptz');
    });

    it('deletedAt doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const deleteDateCols = storage.columns.filter(
        (col) =>
          col.target === AppBaseEntity &&
          col.propertyName === 'deletedAt' &&
          col.mode === 'deleteDate',
      );
      expect(deleteDateCols).toHaveLength(1);
      expect((deleteDateCols[0].options as any).type).toBe('timestamptz');
    });
  });

  describe('Todo entity — Colonnes de date spécifiques', () => {
    it('deadline doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const deadlineCols = storage.columns.filter(
        (col) => col.target === Todo && col.propertyName === 'deadline',
      );
      expect(deadlineCols).toHaveLength(1);
      expect((deadlineCols[0].options as any).type).toBe('timestamptz');
    });

    it('completedAt doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const completedAtCols = storage.columns.filter(
        (col) => col.target === Todo && col.propertyName === 'completedAt',
      );
      expect(completedAtCols).toHaveLength(1);
      expect((completedAtCols[0].options as any).type).toBe('timestamptz');
    });
  });

  describe('Notification entity — Toutes colonnes de date', () => {
    it('sentAt doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const cols = storage.columns.filter(
        (col) => col.target === Notification && col.propertyName === 'sentAt',
      );
      expect(cols).toHaveLength(1);
      expect((cols[0].options as any).type).toBe('timestamptz');
    });

    it('deliveredAt doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const cols = storage.columns.filter(
        (col) =>
          col.target === Notification && col.propertyName === 'deliveredAt',
      );
      expect(cols).toHaveLength(1);
      expect((cols[0].options as any).type).toBe('timestamptz');
    });

    it('createdAt (Notification) doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const cols = storage.columns.filter(
        (col) =>
          col.target === Notification &&
          col.propertyName === 'createdAt' &&
          col.mode === 'createDate',
      );
      expect(cols).toHaveLength(1);
      expect((cols[0].options as any).type).toBe('timestamptz');
    });

    it('updatedAt (Notification) doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const cols = storage.columns.filter(
        (col) =>
          col.target === Notification &&
          col.propertyName === 'updatedAt' &&
          col.mode === 'updateDate',
      );
      expect(cols).toHaveLength(1);
      expect((cols[0].options as any).type).toBe('timestamptz');
    });
  });

  describe('User entity — Colonnes de date', () => {
    it('created_at doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const cols = storage.columns.filter(
        (col) =>
          col.target === User &&
          col.propertyName === 'created_at' &&
          col.mode === 'createDate',
      );
      expect(cols).toHaveLength(1);
      expect((cols[0].options as any).type).toBe('timestamptz');
    });

    it('updated_at doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const cols = storage.columns.filter(
        (col) =>
          col.target === User &&
          col.propertyName === 'updated_at' &&
          col.mode === 'updateDate',
      );
      expect(cols).toHaveLength(1);
      expect((cols[0].options as any).type).toBe('timestamptz');
    });

    it('deletion_requested_at doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const cols = storage.columns.filter(
        (col) =>
          col.target === User && col.propertyName === 'deletion_requested_at',
      );
      expect(cols).toHaveLength(1);
      expect((cols[0].options as any).type).toBe('timestamptz');
    });
  });

  describe('AdminUser entity — Colonnes de date', () => {
    it('createdAt (AdminUser) doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const cols = storage.columns.filter(
        (col) =>
          col.target === AdminUser &&
          col.propertyName === 'createdAt' &&
          col.mode === 'createDate',
      );
      expect(cols).toHaveLength(1);
      expect((cols[0].options as any).type).toBe('timestamptz');
    });

    it('updatedAt (AdminUser) doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const cols = storage.columns.filter(
        (col) =>
          col.target === AdminUser &&
          col.propertyName === 'updatedAt' &&
          col.mode === 'updateDate',
      );
      expect(cols).toHaveLength(1);
      expect((cols[0].options as any).type).toBe('timestamptz');
    });
  });

  describe('AuditLog entity — Colonne timestamp', () => {
    it('timestamp (AuditLog) doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const cols = storage.columns.filter(
        (col) =>
          col.target === AuditLog &&
          col.propertyName === 'timestamp' &&
          col.mode === 'createDate',
      );
      expect(cols).toHaveLength(1);
      expect((cols[0].options as any).type).toBe('timestamptz');
    });
  });

  describe('SyncLog entity — Colonnes de date', () => {
    it('startedAt (SyncLog) doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const cols = storage.columns.filter(
        (col) =>
          col.target === SyncLog &&
          col.propertyName === 'startedAt' &&
          col.mode === 'createDate',
      );
      expect(cols).toHaveLength(1);
      expect((cols[0].options as any).type).toBe('timestamptz');
    });

    it('completedAt (SyncLog) doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const cols = storage.columns.filter(
        (col) => col.target === SyncLog && col.propertyName === 'completedAt',
      );
      expect(cols).toHaveLength(1);
      expect((cols[0].options as any).type).toBe('timestamptz');
    });
  });

  describe('SyncConflict entity — Colonne resolvedAt', () => {
    it('resolvedAt (SyncConflict) doit utiliser timestamptz', () => {
      const storage = getMetadataArgsStorage();
      const cols = storage.columns.filter(
        (col) =>
          col.target === SyncConflict &&
          col.propertyName === 'resolvedAt' &&
          col.mode === 'createDate',
      );
      expect(cols).toHaveLength(1);
      expect((cols[0].options as any).type).toBe('timestamptz');
    });
  });

  describe('Authorization entities — Colonnes de date', () => {
    const authEntities: Array<[string, new (...args: any[]) => any]> = [
      ['Role', Role],
      ['Permission', Permission],
      ['SubscriptionTier', SubscriptionTier],
      ['UserRole', UserRole],
      ['UserPermission', UserPermission],
      ['UserSubscription', UserSubscription],
      ['ResourceShare', ResourceShare],
    ];

    authEntities.forEach(([name, EntityClass]) => {
      it(`${name}: aucune colonne createDate/updateDate ne doit utiliser 'timestamp'`, () => {
        const storage = getMetadataArgsStorage();
        const dateColumns = storage.columns.filter(
          (col) =>
            col.target === EntityClass &&
            (col.mode === 'createDate' ||
              col.mode === 'updateDate' ||
              col.mode === 'deleteDate'),
        );
        dateColumns.forEach((col) => {
          const type = (col.options as any)?.type;
          expect(type).toBe('timestamptz');
        });
      });

      it(`${name}: colonnes expires_at/expiresAt utilisent 'timestamptz'`, () => {
        const storage = getMetadataArgsStorage();
        const expiresAtCols = storage.columns.filter(
          (col) =>
            col.target === EntityClass &&
            (col.propertyName === 'expiresAt' ||
              col.propertyName === 'expires_at'),
        );
        expiresAtCols.forEach((col) => {
          expect((col.options as any)?.type).toBe('timestamptz');
        });
      });
    });
  });
});
