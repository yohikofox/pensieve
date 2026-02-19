import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailService } from './email.service';

/**
 * EmailModule — ADR-030: Transactional Email Provider
 *
 * Provides EmailService using Resend SDK for transactional emails.
 * Injects RESEND_CLIENT token for testability.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'RESEND_CLIENT',
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('RESEND_API_KEY');
        if (!apiKey) {
          // No-op client when Resend is not configured
          return { emails: { send: async () => ({ data: null, error: null }) } };
        }
        return new Resend(apiKey);
      },
      inject: [ConfigService],
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
