import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration: Add debug_mode_access column to users table
 * Story: 7.1 - Support Mode avec Permissions Backend
 *
 * Adds a boolean column to control backend permission for debug mode access.
 * This enables dynamic control of debug features without app republishing.
 */
export class AddDebugModeAccessToUsers1739750000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'debug_mode_access',
        type: 'boolean',
        default: false,
        comment: 'Backend permission to access debug mode features',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'debug_mode_access');
  }
}
