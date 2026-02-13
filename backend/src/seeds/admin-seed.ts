import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;
const DEFAULT_SUPER_ADMIN = {
  email: 'admin@pensieve.local',
  name: 'Super Admin',
  password: 'ChangeMe123!',
};

export async function seedAdmin(dataSource: DataSource): Promise<void> {
  console.log('🌱 Seeding admin users...');

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    // Check if super admin already exists
    const existing = await queryRunner.query(
      'SELECT id FROM admin_users WHERE email = $1',
      [DEFAULT_SUPER_ADMIN.email],
    );

    if (existing.length > 0) {
      console.log(
        `  ✓ Super admin "${DEFAULT_SUPER_ADMIN.email}" already exists`,
      );
      return;
    }

    // Create super admin
    const passwordHash = await bcrypt.hash(
      DEFAULT_SUPER_ADMIN.password,
      BCRYPT_ROUNDS,
    );

    await queryRunner.query(
      `INSERT INTO admin_users (email, name, password_hash, is_super_admin, must_change_password)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        DEFAULT_SUPER_ADMIN.email,
        DEFAULT_SUPER_ADMIN.name,
        passwordHash,
        true, // is_super_admin
        true, // must_change_password
      ],
    );

    console.log('  ✓ Created super admin');
    console.log(`     Email: ${DEFAULT_SUPER_ADMIN.email}`);
    console.log(`     Password: ${DEFAULT_SUPER_ADMIN.password}`);
    console.log('     ⚠️  MUST CHANGE PASSWORD ON FIRST LOGIN');
    console.log('');
    console.log('✅ Admin seed completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding admin users:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }
}
