/**
 * EmailService Unit Tests — 100% coverage (AC9)
 *
 * Tests all methods of EmailService with mocked Resend client.
 * Follows TDD Red-Green-Refactor and ADR-023 Result Pattern.
 */

import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';
import type { Resend } from 'resend';

// =============================================================================
// Mock Setup
// =============================================================================

const mockSend = jest.fn();
const mockResendClient = {
  emails: { send: mockSend },
} as unknown as Resend;

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string, defaultVal?: string) => {
    const config: Record<string, string> = {
      RESEND_API_KEY: 're_test_key',
      EMAIL_FROM: 'noreply@pensine.example.com',
    };
    return config[key] ?? defaultVal ?? '';
  }),
} as unknown as ConfigService;

// =============================================================================
// Tests
// =============================================================================

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailService(mockResendClient, mockConfigService);
  });

  // ---------------------------------------------------------------------------
  // sendResetPassword
  // ---------------------------------------------------------------------------

  describe('sendResetPassword', () => {
    it('returns success when Resend call succeeds', async () => {
      mockSend.mockResolvedValueOnce({
        data: { id: 'email-id-123' },
        error: null,
      });

      const result = await service.sendResetPassword(
        'user@example.com',
        'https://api.pensine.example.local/reset?token=abc',
      );

      expect(result.type).toBe('success');
    });

    it('calls Resend with correct to field', async () => {
      mockSend.mockResolvedValueOnce({ data: { id: 'x' }, error: null });

      await service.sendResetPassword(
        'target@example.com',
        'https://api.pensine.example.local/reset?token=abc',
      );

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'target@example.com' }),
      );
    });

    it('calls Resend with correct from field from config', async () => {
      mockSend.mockResolvedValueOnce({ data: { id: 'x' }, error: null });

      await service.sendResetPassword(
        'user@example.com',
        'https://api.pensine.example.local/reset?token=abc',
      );

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'noreply@pensine.example.com' }),
      );
    });

    it('subject contains "Réinitialisation"', async () => {
      mockSend.mockResolvedValueOnce({ data: { id: 'x' }, error: null });

      await service.sendResetPassword(
        'user@example.com',
        'https://api.pensine.example.local/reset?token=abc',
      );

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.subject).toContain('Réinitialisation');
    });

    it('html contains the reset URL', async () => {
      mockSend.mockResolvedValueOnce({ data: { id: 'x' }, error: null });
      const resetUrl = 'https://api.pensine.example.local/reset?token=abc123';

      await service.sendResetPassword('user@example.com', resetUrl);

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain(resetUrl);
    });

    it('returns network_error when Resend throws', async () => {
      mockSend.mockRejectedValueOnce(new Error('SMTP connection failed'));

      const result = await service.sendResetPassword(
        'user@example.com',
        'https://api.pensine.example.local/reset?token=abc',
      );

      expect(result.type).toBe('network_error');
      expect(result.error).toContain('SMTP connection failed');
    });

    it('uses default EMAIL_FROM when config returns undefined', async () => {
      const configWithNoFrom = {
        get: jest.fn().mockReturnValue(undefined),
      } as unknown as ConfigService;
      const serviceWithDefaultFrom = new EmailService(
        mockResendClient,
        configWithNoFrom,
      );
      mockSend.mockResolvedValueOnce({ data: { id: 'x' }, error: null });

      await serviceWithDefaultFrom.sendResetPassword(
        'user@example.com',
        'https://example.com/reset',
      );

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.from).toBe('noreply@pensine.example.com');
    });
  });

  // ---------------------------------------------------------------------------
  // sendEmailVerification
  // ---------------------------------------------------------------------------

  describe('sendEmailVerification', () => {
    it('returns success when Resend call succeeds', async () => {
      mockSend.mockResolvedValueOnce({ data: { id: 'v-id' }, error: null });

      const result = await service.sendEmailVerification(
        'new@example.com',
        'https://api.pensine.example.local/verify?token=xyz',
      );

      expect(result.type).toBe('success');
    });

    it('calls Resend with correct to field', async () => {
      mockSend.mockResolvedValueOnce({ data: { id: 'x' }, error: null });

      await service.sendEmailVerification(
        'verify@example.com',
        'https://api.pensine.example.local/verify?token=xyz',
      );

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'verify@example.com' }),
      );
    });

    it('subject contains "Vérif"', async () => {
      mockSend.mockResolvedValueOnce({ data: { id: 'x' }, error: null });

      await service.sendEmailVerification(
        'new@example.com',
        'https://api.pensine.example.local/verify?token=xyz',
      );

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.subject).toContain('Vérif');
    });

    it('html contains the verification URL', async () => {
      mockSend.mockResolvedValueOnce({ data: { id: 'x' }, error: null });
      const verifyUrl = 'https://api.pensine.example.local/verify?token=xyz789';

      await service.sendEmailVerification('new@example.com', verifyUrl);

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain(verifyUrl);
    });

    it('returns network_error when Resend throws', async () => {
      mockSend.mockRejectedValueOnce(new Error('Rate limit exceeded'));

      const result = await service.sendEmailVerification(
        'new@example.com',
        'https://api.pensine.example.local/verify?token=xyz',
      );

      expect(result.type).toBe('network_error');
      expect(result.error).toContain('Rate limit exceeded');
    });
  });
});
