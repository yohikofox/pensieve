import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Resend } from 'resend';
import {
  type Result,
  success,
  networkError,
} from '../common/types/result.type';

/**
 * EmailService — ADR-030: Transactional Email Provider Resend
 *
 * Handles all transactional email delivery via Resend API.
 * Used by Better Auth hooks (sendResetPassword, sendEmailVerification).
 *
 * Injects Resend client via 'RESEND_CLIENT' token for testability.
 */
@Injectable()
export class EmailService {
  constructor(
    @Inject('RESEND_CLIENT') private readonly resend: Resend,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Send password reset email — called by Better Auth sendResetPassword hook
   *
   * @param email - User email address
   * @param url   - Password reset URL with token
   * @returns Result<void> — success or network_error (ADR-023)
   */
  async sendResetPassword(email: string, url: string): Promise<Result<void>> {
    const from =
      this.configService.get<string>('EMAIL_FROM') ??
      'noreply@pensine.example.com';

    try {
      await this.resend.emails.send({
        from,
        to: email,
        subject: 'Réinitialisation de votre mot de passe Pensine',
        html: this.buildResetPasswordHtml(url),
      });
      return success(undefined);
    } catch (err) {
      return networkError(`Email delivery failed: ${(err as Error).message}`);
    }
  }

  /**
   * Send email verification — called by Better Auth sendVerificationEmail hook
   *
   * @param email - User email address
   * @param url   - Verification URL with token
   * @returns Result<void> — success or network_error (ADR-023)
   */
  async sendEmailVerification(
    email: string,
    url: string,
  ): Promise<Result<void>> {
    const from =
      this.configService.get<string>('EMAIL_FROM') ??
      'noreply@pensine.example.com';

    try {
      await this.resend.emails.send({
        from,
        to: email,
        subject: 'Vérifiez votre adresse email Pensine',
        html: this.buildVerificationHtml(url),
      });
      return success(undefined);
    } catch (err) {
      return networkError(`Email delivery failed: ${(err as Error).message}`);
    }
  }

  private buildResetPasswordHtml(url: string): string {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Réinitialisation de votre mot de passe</h2>
        <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
        <p><a href="${url}" style="background: #2563EB; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Réinitialiser mon mot de passe
        </a></p>
        <p style="color: #6B7280; font-size: 14px;">
          Ce lien expire dans 1 heure. Si vous n'avez pas demandé de réinitialisation, ignorez cet email.
        </p>
      </div>
    `;
  }

  private buildVerificationHtml(url: string): string {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Vérifiez votre adresse email</h2>
        <p>Cliquez sur le lien ci-dessous pour vérifier votre adresse email :</p>
        <p><a href="${url}" style="background: #2563EB; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Vérifier mon email
        </a></p>
        <p style="color: #6B7280; font-size: 14px;">
          Ce lien expire dans 24 heures.
        </p>
      </div>
    `;
  }
}
