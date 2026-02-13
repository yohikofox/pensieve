import { Command } from 'commander';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AdminUser } from '../modules/admin-auth/domain/entities/admin-user.entity';

const BCRYPT_ROUNDS = 10;

async function getDataSource(): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [AdminUser],
    synchronize: false,
  });
  await dataSource.initialize();
  return dataSource;
}

function generatePassword(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const program = new Command();

program
  .name('admin-cli')
  .description('CLI to manage admin users')
  .version('1.0.0');

// Create admin
program
  .command('create <email> <name>')
  .description('Create a new admin user')
  .action(async (email: string, name: string) => {
    const dataSource = await getDataSource();
    const adminRepo = dataSource.getRepository(AdminUser);

    const existing = await adminRepo.findOne({ where: { email } });
    if (existing) {
      console.error(`❌ Admin with email ${email} already exists`);
      process.exit(1);
    }

    const temporaryPassword = generatePassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const admin = adminRepo.create({
      email,
      name,
      passwordHash,
      isSuperAdmin: false,
      mustChangePassword: true,
    });

    await adminRepo.save(admin);

    console.log('✅ Admin created successfully!');
    console.log(`Email: ${email}`);
    console.log(`Name: ${name}`);
    console.log(`Temporary password: ${temporaryPassword}`);
    console.log('⚠️  User must change password on first login');

    await dataSource.destroy();
  });

// List admins
program
  .command('list')
  .description('List all admin users')
  .action(async () => {
    const dataSource = await getDataSource();
    const adminRepo = dataSource.getRepository(AdminUser);

    const admins = await adminRepo.find({
      order: { createdAt: 'ASC' },
    });

    console.log('📋 Admin Users:');
    console.log('');
    admins.forEach((admin) => {
      const badge = admin.isSuperAdmin ? '[SUPER ADMIN]' : '[ADMIN]';
      const mustChange = admin.mustChangePassword
        ? '⚠️  Must change password'
        : '';
      console.log(`${badge} ${admin.email} - ${admin.name} ${mustChange}`);
    });
    console.log('');
    console.log(`Total: ${admins.length} admins`);

    await dataSource.destroy();
  });

// Delete admin
program
  .command('delete <email>')
  .description('Delete an admin user')
  .action(async (email: string) => {
    const dataSource = await getDataSource();
    const adminRepo = dataSource.getRepository(AdminUser);

    const admin = await adminRepo.findOne({ where: { email } });
    if (!admin) {
      console.error(`❌ Admin with email ${email} not found`);
      process.exit(1);
    }

    if (admin.isSuperAdmin) {
      console.error('❌ Cannot delete super admin');
      process.exit(1);
    }

    await adminRepo.remove(admin);

    console.log(`✅ Admin ${email} deleted successfully`);

    await dataSource.destroy();
  });

// Reset password
program
  .command('reset-password <email>')
  .description('Reset admin password (generates new temporary password)')
  .action(async (email: string) => {
    const dataSource = await getDataSource();
    const adminRepo = dataSource.getRepository(AdminUser);

    const admin = await adminRepo.findOne({ where: { email } });
    if (!admin) {
      console.error(`❌ Admin with email ${email} not found`);
      process.exit(1);
    }

    const newPassword = generatePassword();
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    admin.passwordHash = passwordHash;
    admin.mustChangePassword = true;
    await adminRepo.save(admin);

    console.log('✅ Password reset successfully!');
    console.log(`Email: ${email}`);
    console.log(`New temporary password: ${newPassword}`);
    console.log('⚠️  User must change password on next login');

    await dataSource.destroy();
  });

program.parse();
