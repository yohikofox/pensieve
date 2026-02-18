import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableIndex,
} from 'typeorm';

/**
 * Migration: Add Sync Columns and Tables
 * Story 6.1: Infrastructure de Synchronisation WatermelonDB
 *
 * Creates:
 * - sync_logs table (AC7: Monitoring)
 * - sync_conflicts table (AC3: Conflict audit trail)
 *
 * Adds sync columns to existing tables:
 * - thoughts, ideas, todos (captures when implemented)
 * - last_modified_at: BIGINT timestamp in milliseconds
 * - _status: TEXT ('active' | 'deleted') for soft delete
 *
 * Adds indexes for sync performance (ADR-009)
 * Adds triggers for auto-update last_modified_at
 *
 * Task 2: Sync-Compatible Schema Migrations
 */
export class AddSyncColumnsAndTables1739640000000 implements MigrationInterface {
  name = 'AddSyncColumnsAndTables1739640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // 1. Create sync_logs table (AC7: Monitoring)
    // ========================================
    await queryRunner.createTable(
      new Table({
        name: 'sync_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
            comment: 'User who performed the sync',
          },
          {
            name: 'syncType',
            type: 'text',
            isNullable: false,
            comment: "Sync operation type: 'pull' | 'push'",
          },
          {
            name: 'startedAt',
            type: 'timestamp',
            isNullable: false,
            default: 'NOW()',
            comment: 'Sync start timestamp',
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
            comment: 'Sync completion timestamp',
          },
          {
            name: 'durationMs',
            type: 'int',
            isNullable: false,
            default: 0,
            comment: 'Sync duration in milliseconds',
          },
          {
            name: 'recordsSynced',
            type: 'int',
            isNullable: false,
            default: 0,
            comment: 'Number of records synced',
          },
          {
            name: 'status',
            type: 'text',
            isNullable: false,
            comment: "Sync status: 'success' | 'error' | 'partial'",
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
            comment: 'Error details if failed',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            comment: 'Additional sync metadata',
          },
        ],
      }),
      true,
    );

    // Index for monitoring queries
    await queryRunner.createIndex(
      'sync_logs',
      new TableIndex({
        name: 'IDX_SYNC_LOGS_USER_STARTED',
        columnNames: ['userId', 'startedAt'],
      }),
    );

    // ========================================
    // 2. Create sync_conflicts table (AC3: Conflict audit)
    // ========================================
    await queryRunner.createTable(
      new Table({
        name: 'sync_conflicts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
            comment: 'User who encountered the conflict',
          },
          {
            name: 'entity',
            type: 'text',
            isNullable: false,
            comment: "Entity type: 'captures' | 'thoughts' | 'ideas' | 'todos'",
          },
          {
            name: 'recordId',
            type: 'uuid',
            isNullable: false,
            comment: 'ID of the conflicted record',
          },
          {
            name: 'conflictType',
            type: 'text',
            isNullable: false,
            comment: 'Type of conflict detected',
          },
          {
            name: 'resolutionStrategy',
            type: 'text',
            isNullable: false,
            comment:
              "Resolution: 'client_wins' | 'server_wins' | 'per_column_merge'",
          },
          {
            name: 'clientValue',
            type: 'jsonb',
            isNullable: true,
            comment: "Client's version of the record",
          },
          {
            name: 'serverValue',
            type: 'jsonb',
            isNullable: true,
            comment: "Server's version of the record",
          },
          {
            name: 'resolvedValue',
            type: 'jsonb',
            isNullable: true,
            comment: 'Final resolved value',
          },
          {
            name: 'resolvedAt',
            type: 'timestamp',
            isNullable: false,
            default: 'NOW()',
            comment: 'When conflict was resolved',
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
            comment: 'Additional context',
          },
        ],
      }),
      true,
    );

    // Index for conflict analysis
    await queryRunner.createIndex(
      'sync_conflicts',
      new TableIndex({
        name: 'IDX_SYNC_CONFLICTS_USER_ENTITY',
        columnNames: ['userId', 'entity', 'resolvedAt'],
      }),
    );

    // ========================================
    // 3. Add sync columns to thoughts table
    // ========================================
    await queryRunner.addColumn(
      'thoughts',
      new TableColumn({
        name: 'last_modified_at',
        type: 'bigint',
        isNullable: false,
        default: '(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint',
        comment: 'Last modification timestamp in milliseconds (sync protocol)',
      }),
    );

    await queryRunner.addColumn(
      'thoughts',
      new TableColumn({
        name: '_status',
        type: 'text',
        isNullable: false,
        default: "'active'",
        comment: "Record status: 'active' | 'deleted' (soft delete for sync)",
      }),
    );

    await queryRunner.createIndex(
      'thoughts',
      new TableIndex({
        name: 'IDX_THOUGHTS_LAST_MODIFIED',
        columnNames: ['last_modified_at'],
      }),
    );

    // ========================================
    // 4. Add sync columns to ideas table
    // ========================================
    await queryRunner.addColumn(
      'ideas',
      new TableColumn({
        name: 'last_modified_at',
        type: 'bigint',
        isNullable: false,
        default: '(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint',
        comment: 'Last modification timestamp in milliseconds (sync protocol)',
      }),
    );

    await queryRunner.addColumn(
      'ideas',
      new TableColumn({
        name: '_status',
        type: 'text',
        isNullable: false,
        default: "'active'",
        comment: "Record status: 'active' | 'deleted' (soft delete for sync)",
      }),
    );

    await queryRunner.createIndex(
      'ideas',
      new TableIndex({
        name: 'IDX_IDEAS_LAST_MODIFIED',
        columnNames: ['last_modified_at'],
      }),
    );

    // ========================================
    // 5. Add sync columns to todos table
    // ========================================
    await queryRunner.addColumn(
      'todos',
      new TableColumn({
        name: 'last_modified_at',
        type: 'bigint',
        isNullable: false,
        default: '(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint',
        comment: 'Last modification timestamp in milliseconds (sync protocol)',
      }),
    );

    await queryRunner.addColumn(
      'todos',
      new TableColumn({
        name: '_status',
        type: 'text',
        isNullable: false,
        default: "'active'",
        comment: "Record status: 'active' | 'deleted' (soft delete for sync)",
      }),
    );

    await queryRunner.createIndex(
      'todos',
      new TableIndex({
        name: 'IDX_TODOS_LAST_MODIFIED',
        columnNames: ['last_modified_at'],
      }),
    );

    // ========================================
    // 6. Create trigger function for auto-update last_modified_at
    // ========================================
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_last_modified()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.last_modified_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Add triggers to all tables with last_modified_at
    await queryRunner.query(`
      CREATE TRIGGER thoughts_update_last_modified
      BEFORE UPDATE ON thoughts
      FOR EACH ROW
      EXECUTE FUNCTION update_last_modified();
    `);

    await queryRunner.query(`
      CREATE TRIGGER ideas_update_last_modified
      BEFORE UPDATE ON ideas
      FOR EACH ROW
      EXECUTE FUNCTION update_last_modified();
    `);

    await queryRunner.query(`
      CREATE TRIGGER todos_update_last_modified
      BEFORE UPDATE ON todos
      FOR EACH ROW
      EXECUTE FUNCTION update_last_modified();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS thoughts_update_last_modified ON thoughts',
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS ideas_update_last_modified ON ideas',
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS todos_update_last_modified ON todos',
    );

    // Drop trigger function
    await queryRunner.query('DROP FUNCTION IF EXISTS update_last_modified()');

    // Drop sync columns and indexes from todos
    await queryRunner.dropIndex('todos', 'IDX_TODOS_LAST_MODIFIED');
    await queryRunner.dropColumn('todos', '_status');
    await queryRunner.dropColumn('todos', 'last_modified_at');

    // Drop sync columns and indexes from ideas
    await queryRunner.dropIndex('ideas', 'IDX_IDEAS_LAST_MODIFIED');
    await queryRunner.dropColumn('ideas', '_status');
    await queryRunner.dropColumn('ideas', 'last_modified_at');

    // Drop sync columns and indexes from thoughts
    await queryRunner.dropIndex('thoughts', 'IDX_THOUGHTS_LAST_MODIFIED');
    await queryRunner.dropColumn('thoughts', '_status');
    await queryRunner.dropColumn('thoughts', 'last_modified_at');

    // Drop sync_conflicts table
    await queryRunner.dropIndex(
      'sync_conflicts',
      'IDX_SYNC_CONFLICTS_USER_ENTITY',
    );
    await queryRunner.dropTable('sync_conflicts');

    // Drop sync_logs table
    await queryRunner.dropIndex('sync_logs', 'IDX_SYNC_LOGS_USER_STARTED');
    await queryRunner.dropTable('sync_logs');
  }
}
