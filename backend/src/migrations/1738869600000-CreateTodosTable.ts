import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Migration: Create Todos Table
 * Story 4.3: Extraction Automatique d'Actions
 *
 * Creates table for Action Context:
 * - todos: Actionable tasks extracted from captures
 *
 * Relations:
 * - Todo.thoughtId → thoughts.id (CASCADE delete)
 * - Todo.ideaId → ideas.id (SET NULL delete - optional link)
 * - Todo.captureId → captures.id (external context - to be added later)
 *
 * Subtask 2.2: Create TypeORM migration for todos table
 * Subtask 2.3: Add indices (captureId, thoughtId, userId, status, deadline, priority)
 * Subtask 2.6: Add cascade delete rules (when Thought deleted → Todos deleted)
 */
export class CreateTodosTable1738869600000 implements MigrationInterface {
  name = 'CreateTodosTable1738869600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // Create 'todos' table
    // ========================================
    await queryRunner.createTable(
      new Table({
        name: 'todos',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'thoughtId',
            type: 'uuid',
            isNullable: false,
            comment: 'Reference to parent Thought (Knowledge Context)',
          },
          {
            name: 'ideaId',
            type: 'uuid',
            isNullable: true,
            comment: 'Optional reference to related Idea',
          },
          {
            name: 'captureId',
            type: 'uuid',
            isNullable: false,
            comment: 'Reference to source Capture (for navigation)',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
            comment: 'User isolation (NFR13)',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: false,
            comment: 'Actionable task description',
          },
          {
            name: 'status',
            type: 'varchar',
            isNullable: false,
            default: "'todo'",
            comment: "Status: 'todo' | 'launched' | 'in_progress' | 'completed' | 'abandoned'",
          },
          {
            name: 'deadline',
            type: 'timestamp',
            isNullable: true,
            comment: 'Parsed deadline date (null if no deadline)',
          },
          {
            name: 'deadlineConfidence',
            type: 'float',
            isNullable: true,
            comment: 'Confidence score (0-1) for ambiguous deadline parsing (AC3)',
          },
          {
            name: 'priority',
            type: 'varchar',
            isNullable: false,
            default: "'medium'",
            comment: "Priority: 'low' | 'medium' | 'high'",
          },
          {
            name: 'priorityConfidence',
            type: 'float',
            isNullable: true,
            comment: 'Confidence score (0-1) for inferred priority (AC4)',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
            comment: 'Timestamp when todo was marked completed',
          },
        ],
        indices: [
          {
            name: 'idx_todos_thoughtId',
            columnNames: ['thoughtId'],
          },
          {
            name: 'idx_todos_ideaId',
            columnNames: ['ideaId'],
          },
          {
            name: 'idx_todos_captureId',
            columnNames: ['captureId'],
          },
          {
            name: 'idx_todos_userId',
            columnNames: ['userId'],
          },
          {
            name: 'idx_todos_status',
            columnNames: ['status'],
          },
          {
            name: 'idx_todos_deadline',
            columnNames: ['deadline'],
          },
          {
            name: 'idx_todos_priority',
            columnNames: ['priority'],
          },
          {
            name: 'idx_todos_createdAt',
            columnNames: ['createdAt'],
          },
        ],
      }),
      true,
    );

    // ========================================
    // Add foreign key: todos.thoughtId → thoughts.id (CASCADE delete)
    // Subtask 2.6: When Thought deleted → Todos deleted
    // ========================================
    await queryRunner.createForeignKey(
      'todos',
      new TableForeignKey({
        name: 'fk_todos_thoughtId',
        columnNames: ['thoughtId'],
        referencedTableName: 'thoughts',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE', // Delete todos when thought is deleted (AC2)
        onUpdate: 'CASCADE',
      }),
    );

    // ========================================
    // Add foreign key: todos.ideaId → ideas.id (SET NULL delete)
    // Optional relationship - preserve todo if idea is deleted
    // ========================================
    await queryRunner.createForeignKey(
      'todos',
      new TableForeignKey({
        name: 'fk_todos_ideaId',
        columnNames: ['ideaId'],
        referencedTableName: 'ideas',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL', // Preserve todo if idea is deleted
        onUpdate: 'CASCADE',
      }),
    );

    // ========================================
    // IMPORTANT: Foreign key for todos.captureId → captures.id
    // ========================================
    // Not added in this migration because:
    // 1. Capture entity exists but may not have a TypeORM migration yet
    // 2. Adding FK now could cause deployment issues if captures table structure changes
    // 3. captureId is still validated at application level (NOT NULL constraint enforced)
    //
    // TODO: Add foreign key in future migration when Capture Context is fully migrated:
    // await queryRunner.createForeignKey(
    //   'todos',
    //   new TableForeignKey({
    //     name: 'fk_todos_captureId',
    //     columnNames: ['captureId'],
    //     referencedTableName: 'captures',
    //     referencedColumnNames: ['id'],
    //     onDelete: 'CASCADE',
    //     onUpdate: 'CASCADE',
    //   }),
    // );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    await queryRunner.dropForeignKey('todos', 'fk_todos_ideaId');
    await queryRunner.dropForeignKey('todos', 'fk_todos_thoughtId');

    // Drop table
    await queryRunner.dropTable('todos', true);
  }
}
