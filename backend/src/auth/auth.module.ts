import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailModule } from '../email/email.module';
import { EmailService } from '../email/email.service';
import { AuthController } from './auth.controller';
import { BetterAuthGuard } from './guards/better-auth.guard';
import { setEmailService, setUserProvisioningCallback } from './auth.config';
import { User } from '../modules/shared/infrastructure/persistence/typeorm/entities/user.entity';

/**
 * AuthModule — ADR-029: Better Auth Self-Hosted
 *
 * Provides Better Auth HTTP handler and BetterAuthGuard.
 * Initializes EmailService injection into Better Auth config on module init.
 *
 * Architecture note: auth/ is an infrastructure module, not a DDD bounded context.
 * Auth (Better Auth) ≠ AuthZ (authorization/ module) — no conflict.
 */
@Module({
  imports: [EmailModule, TypeOrmModule.forFeature([User])],
  controllers: [AuthController],
  providers: [BetterAuthGuard],
  exports: [BetterAuthGuard],
})
export class AuthModule implements OnModuleInit {
  private readonly logger = new Logger(AuthModule.name);

  constructor(
    private readonly emailService: EmailService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  onModuleInit(): void {
    // Validate required env vars at startup — fail fast rather than silently at runtime
    if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
      throw new Error(
        'BETTER_AUTH_SECRET is missing or too short (minimum 32 chars). ' +
          'Generate one with: openssl rand -hex 32',
      );
    }
    if (!process.env.BETTER_AUTH_URL) {
      this.logger.warn('BETTER_AUTH_URL is not set — email verification links may be invalid');
    }

    setEmailService(this.emailService);

    setUserProvisioningCallback(async (userId: string, email: string) => {
      const existing = await this.userRepo.findOne({ where: { id: userId } });
      if (!existing) {
        await this.userRepo.save(
          this.userRepo.create({ id: userId, email, status: 'active' }),
        );
        this.logger.log(`User provisioned: ${userId}`);
      }
    });
  }
}
