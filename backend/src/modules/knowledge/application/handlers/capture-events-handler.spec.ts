/**
 * CaptureEventsHandler Unit Tests
 *
 * Story 16.2 - Task 2: Vérifier le traitement des captures texte (AC2)
 *
 * NOTE ARCHITECTURE : CaptureEventsHandler est un stub destiné à une future
 * intégration event-driven (@nestjs/cqrs). Il N'EST PAS enregistré dans
 * KnowledgeModule.providers et n'est donc pas actif en production.
 *
 * Chemin production actuel (Story 16.2) :
 *   SyncService.processPush() → DigestionJobPublisher.publishJobForTextCapture()
 *
 * Ces tests valident la logique interne du handler en isolation et serviront
 * de régression quand le handler sera branché sur le bus d'événements.
 *
 * Tests:
 * - handleTextCaptureCreated() publie le job via DigestionJobPublisher (bypass transcription)
 * - handleTranscriptionCompleted() publie le job pour les captures audio
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CaptureEventsHandler } from './transcription-completed.handler';
import { DigestionJobPublisher } from '../publishers/digestion-job-publisher.service';

describe('CaptureEventsHandler', () => {
  let handler: CaptureEventsHandler;
  let mockDigestionJobPublisher: jest.Mocked<
    Pick<DigestionJobPublisher, 'publishJobForTextCapture' | 'publishJob'>
  >;

  beforeEach(async () => {
    mockDigestionJobPublisher = {
      publishJobForTextCapture: jest.fn().mockResolvedValue(undefined),
      publishJob: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaptureEventsHandler,
        {
          provide: DigestionJobPublisher,
          useValue: mockDigestionJobPublisher,
        },
      ],
    }).compile();

    handler = module.get<CaptureEventsHandler>(CaptureEventsHandler);
  });

  describe('handleTextCaptureCreated (AC2 — bypass transcription)', () => {
    it('should call publishJobForTextCapture with TEXT type', async () => {
      const event = {
        captureId: 'capture-uuid-text',
        userId: 'user-uuid',
        text: 'Ma pensée importante',
        createdAt: new Date(),
      };

      await handler.handleTextCaptureCreated(event);

      expect(
        mockDigestionJobPublisher.publishJobForTextCapture,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockDigestionJobPublisher.publishJobForTextCapture,
      ).toHaveBeenCalledWith({
        captureId: 'capture-uuid-text',
        userId: 'user-uuid',
        type: 'TEXT',
        state: 'ready',
        userInitiated: true,
      });
    });

    it('should NOT pass through transcription step (rawContent goes directly to GPT)', async () => {
      const event = {
        captureId: 'capture-text-2',
        userId: 'user-2',
        text: 'Bypass whisper',
        createdAt: new Date(),
      };

      await handler.handleTextCaptureCreated(event);

      // publishJob (audio path) ne doit pas être appelé pour le texte
      expect(mockDigestionJobPublisher.publishJob).not.toHaveBeenCalled();
    });
  });

  describe('handleTranscriptionCompleted (audio path — régression)', () => {
    it('should call publishJob with AUDIO type for transcription events', async () => {
      const event = {
        captureId: 'capture-audio',
        userId: 'user-audio',
        transcription: 'Transcription du fichier audio',
        completedAt: new Date(),
      };

      await handler.handleTranscriptionCompleted(event);

      expect(mockDigestionJobPublisher.publishJob).toHaveBeenCalledTimes(1);
      expect(mockDigestionJobPublisher.publishJob).toHaveBeenCalledWith(
        expect.objectContaining({
          captureId: 'capture-audio',
          userId: 'user-audio',
          type: 'AUDIO',
        }),
      );
    });

    it('should NOT call publishJobForTextCapture for audio captures', async () => {
      const event = {
        captureId: 'capture-audio-2',
        userId: 'user-audio-2',
        transcription: 'Audio text',
        completedAt: new Date(),
      };

      await handler.handleTranscriptionCompleted(event);

      expect(
        mockDigestionJobPublisher.publishJobForTextCapture,
      ).not.toHaveBeenCalled();
    });
  });
});
