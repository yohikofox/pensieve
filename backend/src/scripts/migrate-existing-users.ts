/**
 * Script to migrate existing users to authorization system
 * Assigns default "user" role and "free" tier to all users
 * Usage: npm run migrate:users
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: true,
});

async function migrateUsers() {
  try {
    console.log('🔄 Initializing database connection...');
    await AppDataSource.initialize();
    console.log('✅ Database connection established');

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get all users from thoughts, ideas, and todos
      console.log('👥 Fetching existing users...');

      const users = await queryRunner.query(`
        SELECT DISTINCT "userId" as id FROM thoughts
        UNION
        SELECT DISTINCT "userId" as id FROM ideas
        UNION
        SELECT DISTINCT "userId" as id FROM todos
      `);

      console.log(`Found ${users.length} unique users`);

      // Get "user" role ID
      const userRoleResult = await queryRunner.query(
        `SELECT id FROM roles WHERE name = 'user' LIMIT 1`,
      );

      if (userRoleResult.length === 0) {
        throw new Error('User role not found. Please run seed first.');
      }

      const userRoleId = userRoleResult[0].id;

      // Get "free" tier ID
      const freeTierResult = await queryRunner.query(
        `SELECT id FROM subscription_tiers WHERE name = 'free' LIMIT 1`,
      );

      if (freeTierResult.length === 0) {
        throw new Error('Free tier not found. Please run seed first.');
      }

      const freeTierId = freeTierResult[0].id;

      // Assign role and tier to each user
      let assignedCount = 0;
      for (const user of users) {
        // Assign "user" role (if not already assigned)
        const existingRole = await queryRunner.query(
          `SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2 LIMIT 1`,
          [user.id, userRoleId],
        );

        if (existingRole.length === 0) {
          await queryRunner.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
            [user.id, userRoleId],
          );
          console.log(`✅ Assigned "user" role to user ${user.id}`);
        }

        // Assign "free" tier (if not already assigned)
        const existingTier = await queryRunner.query(
          `SELECT 1 FROM user_subscriptions WHERE user_id = $1 AND tier_id = $2 LIMIT 1`,
          [user.id, freeTierId],
        );

        if (existingTier.length === 0) {
          await queryRunner.query(
            `INSERT INTO user_subscriptions (user_id, tier_id, status) VALUES ($1, $2, 'active')`,
            [user.id, freeTierId],
          );
          console.log(`✅ Assigned "free" tier to user ${user.id}`);
          assignedCount++;
        }
      }

      await queryRunner.commitTransaction();
      console.log(`✅ Successfully migrated ${assignedCount} users`);
      console.log('✅ All users now have "user" role and "free" tier');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    await AppDataSource.destroy();
    console.log('✅ Migration complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ User migration failed:', error);
    process.exit(1);
  }
}

migrateUsers();
