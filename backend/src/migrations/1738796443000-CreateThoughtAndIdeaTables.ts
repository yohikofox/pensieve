import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

/**
 * Migration: Create Thought and Idea Tables
 * Story 4.2: Digestion IA - Résumé et Idées Clés
 *
 * Creates tables for Knowledge Context:
 * - thoughts: AI-generated summaries from captures
 * - ideas: Key ideas extracted from captures
 *
 * Relations:
 * - Thought.captureId → captures.id (external context)
 * - Idea.thoughtId → thoughts.id (CASCADE delete)
 */
export class CreateThoughtAndIdeaTables1738796443000 implements MigrationInterface {
  name = 'CreateThoughtAndIdeaTables1738796443000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // Create 'thoughts' table
    // ========================================
    await queryRunner.createTable(
      new Table({
        name: 'thoughts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'captureId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'summary',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'confidenceScore',
            type: 'float',
            isNullable: true,
            comment: 'AI confidence score (0-1): high=0.9, medium=0.6, low=0.3',
          },
          {
            name: 'processingTimeMs',
            type: 'integer',
            isNullable: false,
            comment: 'Processing time in milliseconds for performance monitoring',
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
        ],
        indices: [
          {
            name: 'idx_thoughts_captureId',
            columnNames: ['captureId'],
          },
          {
            name: 'idx_thoughts_userId',
            columnNames: ['userId'],
          },
          {
            name: 'idx_thoughts_createdAt',
            columnNames: ['createdAt'],
          },
        ],
      }),
      true,
    );

    // ========================================
    // Create 'ideas' table
    // ========================================
    await queryRunner.createTable(
      new Table({
        name: 'ideas',
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
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'text',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'orderIndex',
            type: 'integer',
            isNullable: true,
            comment: 'Preserves order from GPT response',
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
        ],
        indices: [
          {
            name: 'idx_ideas_thoughtId',
            columnNames: ['thoughtId'],
          },
          {
            name: 'idx_ideas_userId',
            columnNames: ['userId'],
          },
          {
            name: 'idx_ideas_orderIndex',
            columnNames: ['orderIndex'],
          },
        ],
      }),
      true,
    );

    // ========================================
    // Add foreign key: ideas.thoughtId → thoughts.id (CASCADE delete)
    // ========================================
    await queryRunner.createForeignKey(
      'ideas',
      new TableForeignKey({
        name: 'fk_ideas_thoughtId',
        columnNames: ['thoughtId'],
        referencedTableName: 'thoughts',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE', // Delete ideas when thought is deleted
        onUpdate: 'CASCADE',
      }),
    );

    // Note: Foreign key for thoughts.captureId → captures.id will be added
    // when Capture Context is integrated in future stories
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key first
    await queryRunner.dropForeignKey('ideas', 'fk_ideas_thoughtId');

    // Drop tables in reverse order
    await queryRunner.dropTable('ideas', true);
    await queryRunner.dropTable('thoughts', true);
  }
}
