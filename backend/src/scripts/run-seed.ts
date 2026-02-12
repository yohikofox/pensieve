/**
 * Script to run authorization seed
 * Usage: npm run seed:authorization
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { seedAuthorization } from '../seeds/authorization-seed';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: true,
});

async function runSeed() {
  try {
    console.log('🔄 Initializing database connection...');
    await AppDataSource.initialize();
    console.log('✅ Database connection established');

    console.log('🌱 Running authorization seed...');
    await seedAuthorization(AppDataSource);

    await AppDataSource.destroy();
    console.log('✅ Seed complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

runSeed();
