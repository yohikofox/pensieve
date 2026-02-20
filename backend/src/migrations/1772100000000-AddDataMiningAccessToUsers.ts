import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration: Add data_mining_access column to users table
 *
 * Adds a boolean column to control backend permission for datamining (query builder) access.
 * This flag is assigned from the admin interface and synced to the mobile app at startup.
 */
export class AddDataMiningAccessToUsers1772100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'data_mining_access',
        type: 'boolean',
        default: false,
        comment: 'Backend permission to access datamining (query builder) features',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'data_mining_access');
  }
}
