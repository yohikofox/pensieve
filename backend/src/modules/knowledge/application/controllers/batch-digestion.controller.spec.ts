/**
 * BatchDigestion Controller Tests
 * Tests for AC7: Offline Batch Processing
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BatchDigestionController } from './batch-digestion.controller';
import { DigestionJobPublisher } from '../publishers/digestion-job-publisher.service';
import type { CreateDigestionJobInput } from '../../domain/interfaces/digestion-job-payload.interface';

describe('BatchDigestionController (AC7)', () => {
  let controller: BatchDigestionController;
  let mockPublisher: jest.Mocked<DigestionJobPublisher>;

  beforeEach(async () => {
    // Create mock publisher
    mockPublisher = {
      publishJob: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BatchDigestionController],
      providers: [
        {
          provide: DigestionJobPublisher,
          useValue: mockPublisher,
        },
      ],
    }).compile();

    controller = module.get<BatchDigestionController>(BatchDigestionController);
  });

  describe('batchSubmitDigestion', () => {
    it('should successfully submit multiple captures', async () => {
      // Arrange
      const captures: CreateDigestionJobInput[] = [
        {
          captureId: 'capture-1',
          userId: 'user-1',
          type: 'TEXT',
          state: 'transcribed',
        },
        {
          captureId: 'capture-2',
          userId: 'user-1',
          type: 'AUDIO',
          state: 'transcribed',
        },
      ];

      // Act
      const result = await controller.batchSubmitDigestion({ captures });

      // Assert
      expect(result.totalSubmitted).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
      expect(mockPublisher.publishJob).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures gracefully', async () => {
      // Arrange
      const captures: CreateDigestionJobInput[] = [
        {
          captureId: 'capture-success',
          userId: 'user-1',
          type: 'TEXT',
          state: 'transcribed',
        },
        {
          captureId: 'capture-fail',
          userId: 'user-1',
          type: 'TEXT',
          state: 'transcribed',
        },
        {
          captureId: 'capture-success-2',
          userId: 'user-1',
          type: 'TEXT',
          state: 'transcribed',
        },
      ];

      // Mock: second capture fails
      mockPublisher.publishJob
        .mockResolvedValueOnce(undefined) // First succeeds
        .mockRejectedValueOnce(new Error('Queue full')) // Second fails
        .mockResolvedValueOnce(undefined); // Third succeeds

      // Act
      const result = await controller.batchSubmitDigestion({ captures });

      // Assert (Subtask 7.5: Partial failure handling)
      expect(result.totalSubmitted).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);

      // Check individual results
      expect(result.results[0]).toEqual({
        captureId: 'capture-success',
        success: true,
      });
      expect(result.results[1]).toEqual({
        captureId: 'capture-fail',
        success: false,
        error: 'Queue full',
      });
      expect(result.results[2]).toEqual({
        captureId: 'capture-success-2',
        success: true,
      });
    });

    it('should process captures in order', async () => {
      // Arrange
      const captures: CreateDigestionJobInput[] = [
        {
          captureId: 'capture-1',
          userId: 'user-1',
          type: 'TEXT',
          state: 'transcribed',
        },
        {
          captureId: 'capture-2',
          userId: 'user-1',
          type: 'TEXT',
          state: 'transcribed',
        },
        {
          captureId: 'capture-3',
          userId: 'user-1',
          type: 'TEXT',
          state: 'transcribed',
        },
      ];

      // Act
      await controller.batchSubmitDigestion({ captures });

      // Assert (Subtask 7.3: Order preservation)
      expect(mockPublisher.publishJob).toHaveBeenNthCalledWith(1, captures[0]);
      expect(mockPublisher.publishJob).toHaveBeenNthCalledWith(2, captures[1]);
      expect(mockPublisher.publishJob).toHaveBeenNthCalledWith(3, captures[2]);
    });

    it('should handle empty batch', async () => {
      // Arrange
      const captures: CreateDigestionJobInput[] = [];

      // Act
      const result = await controller.batchSubmitDigestion({ captures });

      // Assert
      expect(result.totalSubmitted).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(0);
      expect(mockPublisher.publishJob).not.toHaveBeenCalled();
    });

    it('should continue processing after individual failures', async () => {
      // Arrange
      const captures: CreateDigestionJobInput[] = [
        {
          captureId: 'capture-1',
          userId: 'user-1',
          type: 'TEXT',
          state: 'transcribed',
        },
        {
          captureId: 'capture-2',
          userId: 'user-1',
          type: 'TEXT',
          state: 'transcribed',
        },
      ];

      // Mock: first fails, second succeeds
      mockPublisher.publishJob
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);

      // Act
      const result = await controller.batchSubmitDigestion({ captures });

      // Assert (Subtask 7.5: Continue after failure)
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(mockPublisher.publishJob).toHaveBeenCalledTimes(2);
    });
  });
});
