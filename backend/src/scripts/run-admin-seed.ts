import 'dotenv/config';
import { DataSource } from 'typeorm';
import { seedAdmin } from '../seeds/admin-seed';

async function runAdminSeed() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('📦 Database connected');

  try {
    await seedAdmin(dataSource);
  } catch (error) {
    console.error('Failed to run admin seed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

runAdminSeed();
