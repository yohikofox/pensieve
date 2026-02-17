import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Migration: Create Captures Table
 * Story 6.3: Persistance des captures côté backend (NFR6 — 0 capture perdue)
 *
 * Creates:
 * - capture_types     : Table référentielle des types ('audio', 'text')
 * - capture_states    : Table référentielle des états ('recording', 'captured', 'failed')
 * - capture_sync_statuses : Table référentielle des statuts sync ('active', 'deleted')
 * - captures          : Entité principale avec FKs et colonnes sync
 *
 * Key design:
 * - id       : UUID backend (PK, source of truth)
 * - clientId : UUID mobile (UNIQUE avec userId pour éviter doublons cross-device)
 * - Trigger  : captures_update_last_modified (réutilise update_last_modified())
 */
export class CreateCapturesTable1771250000000 implements MigrationInterface {
  name = 'CreateCapturesTable1771250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // 1. Tables référentielles
    // ============================================================

    await queryRunner.createTable(
      new Table({
        name: 'capture_types',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'name',
            type: 'text',
            isNullable: false,
            isUnique: true,
            comment: "Type de capture : 'audio' | 'text'",
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `INSERT INTO capture_types (name) VALUES ('audio'), ('text')`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'capture_states',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'name',
            type: 'text',
            isNullable: false,
            isUnique: true,
            comment: "État de capture : 'recording' | 'captured' | 'failed'",
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `INSERT INTO capture_states (name) VALUES ('recording'), ('captured'), ('failed')`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'capture_sync_statuses',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'name',
            type: 'text',
            isNullable: false,
            isUnique: true,
            comment: "Statut de synchronisation : 'active' | 'deleted'",
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `INSERT INTO capture_sync_statuses (name) VALUES ('active'), ('deleted')`,
    );

    // ============================================================
    // 2. Table captures
    // ============================================================

    await queryRunner.createTable(
      new Table({
        name: 'captures',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
            comment: 'UUID backend généré (source of truth serveur)',
          },
          {
            name: 'clientId',
            type: 'uuid',
            isNullable: false,
            comment: 'UUID assigné par le client mobile',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
            comment: 'Isolation utilisateur (NFR13)',
          },
          {
            name: 'typeId',
            type: 'int',
            isNullable: true,
            comment: 'FK vers capture_types',
          },
          {
            name: 'stateId',
            type: 'int',
            isNullable: true,
            comment: 'FK vers capture_states',
          },
          {
            name: 'rawContent',
            type: 'text',
            isNullable: true,
            comment: 'Chemin MinIO (audio) ou texte brut',
          },
          {
            name: 'normalizedText',
            type: 'text',
            isNullable: true,
            comment: 'Transcription normalisée',
          },
          {
            name: 'duration',
            type: 'int',
            isNullable: true,
            comment: 'Durée en ms (audio seulement)',
          },
          {
            name: 'fileSize',
            type: 'int',
            isNullable: true,
            comment: 'Taille du fichier en bytes (audio seulement)',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            isNullable: false,
            default: 'NOW()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            isNullable: false,
            default: 'NOW()',
          },
          {
            name: 'last_modified_at',
            type: 'bigint',
            isNullable: false,
            default: `EXTRACT(EPOCH FROM NOW()) * 1000`,
            comment: 'Timestamp ms depuis epoch (protocole sync WatermelonDB)',
          },
          {
            name: 'syncStatusId',
            type: 'int',
            isNullable: false,
            default: 1,
            comment: 'FK vers capture_sync_statuses (1=active, 2=deleted)',
          },
        ],
      }),
      true,
    );

    // ============================================================
    // 3. Foreign keys
    // ============================================================

    await queryRunner.createForeignKey(
      'captures',
      new TableForeignKey({
        columnNames: ['typeId'],
        referencedTableName: 'capture_types',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'captures',
      new TableForeignKey({
        columnNames: ['stateId'],
        referencedTableName: 'capture_states',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'captures',
      new TableForeignKey({
        columnNames: ['syncStatusId'],
        referencedTableName: 'capture_sync_statuses',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    // ============================================================
    // 4. Contrainte UNIQUE(clientId, userId)
    // ============================================================

    await queryRunner.createIndex(
      'captures',
      new TableIndex({
        name: 'IDX_CAPTURES_CLIENT_USER',
        columnNames: ['clientId', 'userId'],
        isUnique: true,
      }),
    );

    // ============================================================
    // 5. Indexes de performance
    // ============================================================

    await queryRunner.createIndex(
      'captures',
      new TableIndex({
        name: 'IDX_CAPTURES_LAST_MODIFIED',
        columnNames: ['last_modified_at'],
      }),
    );

    await queryRunner.createIndex(
      'captures',
      new TableIndex({
        name: 'IDX_CAPTURES_USER_ID',
        columnNames: ['userId'],
      }),
    );

    // ============================================================
    // 6. Trigger auto-update last_modified_at
    //    Réutilise update_last_modified() créé par la migration sync
    // ============================================================

    await queryRunner.query(`
      CREATE TRIGGER captures_update_last_modified
      BEFORE UPDATE ON captures
      FOR EACH ROW EXECUTE FUNCTION update_last_modified();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS captures_update_last_modified ON captures`,
    );
    await queryRunner.dropTable('captures', true);
    await queryRunner.dropTable('capture_sync_statuses', true);
    await queryRunner.dropTable('capture_states', true);
    await queryRunner.dropTable('capture_types', true);
  }
}
