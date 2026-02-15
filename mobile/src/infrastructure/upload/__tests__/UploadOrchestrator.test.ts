/**
 * UploadOrchestrator Tests
 *
 * Story 6.2 - Task 6.6: Hook audio upload after metadata sync success
 *
 * Workflow:
 * 1. SyncService publishes "SyncSuccess" event after PUSH succeeds
 * 2. UploadOrchestrator listens for "SyncSuccess"
 * 3. For each synced capture with audio (type='audio', raw_content=file_path):
 *    - Enqueue upload via AudioUploadService
 * 4. Background upload worker processes queue
 * 5. After upload success → update capture with audio_url → re-sync
 */

import { UploadOrchestrator } from '../UploadOrchestrator';
import { AudioUploadService } from '../AudioUploadService';
import { EventBus } from '@/contexts/shared/events/EventBus';
import { database } from '../../../database';
import { RepositoryResultType } from '@/contexts/shared/domain/Result';

// Mock dependencies
jest.mock('../AudioUploadService');
jest.mock('../../../database', () => ({
  database: {
    execute: jest.fn(),
  },
}));

describe('UploadOrchestrator', () => {
  let orchestrator: UploadOrchestrator;
  let audioUploadService: jest.Mocked<AudioUploadService>;
  let eventBus: EventBus;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create real EventBus for testing
    eventBus = new EventBus();

    // Create mocked AudioUploadService
    audioUploadService = new AudioUploadService('https://api.test.com') as jest.Mocked<AudioUploadService>;

    orchestrator = new UploadOrchestrator(eventBus, audioUploadService);
  });

  afterEach(() => {
    orchestrator.stop();
    eventBus.complete();
  });

  describe('Constructor & Lifecycle', () => {
    it('should initialize and start listening to SyncSuccess events', () => {
      expect(orchestrator).toBeInstanceOf(UploadOrchestrator);
    });

    it('should stop listening when stopped', () => {
      const publishSpy = jest.spyOn(eventBus, 'publish');

      orchestrator.stop();

      // Publish event after stop
      eventBus.publish({
        type: 'SyncSuccess',
        timestamp: Date.now(),
        payload: { syncedCaptureIds: [] },
      });

      // Should not trigger any action (subscription closed)
      expect(audioUploadService.enqueueUpload).not.toHaveBeenCalled();
    });
  });

  describe('handleSyncSuccess()', () => {
    it('should enqueue audio uploads for synced captures with audio files', async () => {
      const mockCaptureId = 'capture-123';
      const mockFilePath = '/audio/capture-123.m4a';
      const mockFileSize = 50000;

      // Mock database query for captures
      (database.execute as jest.Mock).mockReturnValue({
        rows: [
          {
            id: mockCaptureId,
            type: 'audio',
            raw_content: mockFilePath,
            file_size: mockFileSize,
          },
        ],
      });

      // Mock AudioUploadService.enqueueUpload
      audioUploadService.enqueueUpload.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { uploadId: 'upload-123' },
      });

      // Publish SyncSuccess event
      eventBus.publish({
        type: 'SyncSuccess',
        timestamp: Date.now(),
        payload: { syncedCaptureIds: [mockCaptureId] },
      });

      // Wait for async event handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify database query for audio captures
      const dbCall = (database.execute as jest.Mock).mock.calls[0];
      expect(dbCall[0]).toContain("SELECT id, type, raw_content, file_size");
      expect(dbCall[0]).toContain("WHERE id IN");
      expect(dbCall[0]).toContain("type = 'audio'");
      expect(dbCall[1]).toEqual([mockCaptureId]);

      // Verify AudioUploadService.enqueueUpload called
      expect(audioUploadService.enqueueUpload).toHaveBeenCalledWith(
        mockCaptureId,
        mockFilePath,
        mockFileSize,
      );
    });

    it('should NOT enqueue uploads for text captures', async () => {
      const mockCaptureId = 'capture-text';

      // Mock database query - text capture
      (database.execute as jest.Mock).mockReturnValue({
        rows: [
          {
            id: mockCaptureId,
            type: 'text',
            raw_content: 'Some text content',
            file_size: null,
          },
        ],
      });

      // Publish SyncSuccess event
      eventBus.publish({
        type: 'SyncSuccess',
        timestamp: Date.now(),
        payload: { syncedCaptureIds: [mockCaptureId] },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should NOT call enqueueUpload for text captures
      expect(audioUploadService.enqueueUpload).not.toHaveBeenCalled();
    });

    it('should NOT enqueue uploads for captures without raw_content', async () => {
      const mockCaptureId = 'capture-no-audio';

      // Mock database query - audio capture but no file yet
      (database.execute as jest.Mock).mockReturnValue({
        rows: [
          {
            id: mockCaptureId,
            type: 'audio',
            raw_content: null, // No file path yet
            file_size: null,
          },
        ],
      });

      // Publish SyncSuccess event
      eventBus.publish({
        type: 'SyncSuccess',
        timestamp: Date.now(),
        payload: { syncedCaptureIds: [mockCaptureId] },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should NOT call enqueueUpload if no raw_content
      expect(audioUploadService.enqueueUpload).not.toHaveBeenCalled();
    });

    it('should handle multiple captures in single sync', async () => {
      const mockCaptures = [
        { id: 'capture-1', type: 'audio', raw_content: '/audio/1.m4a', file_size: 10000 },
        { id: 'capture-2', type: 'text', raw_content: 'Text', file_size: null },
        { id: 'capture-3', type: 'audio', raw_content: '/audio/3.m4a', file_size: 20000 },
      ];

      // Mock database query
      (database.execute as jest.Mock).mockReturnValue({
        rows: mockCaptures,
      });

      audioUploadService.enqueueUpload.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { uploadId: 'upload-x' },
      });

      // Publish SyncSuccess event
      eventBus.publish({
        type: 'SyncSuccess',
        timestamp: Date.now(),
        payload: { syncedCaptureIds: ['capture-1', 'capture-2', 'capture-3'] },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should enqueue only 2 audio captures (capture-1, capture-3)
      expect(audioUploadService.enqueueUpload).toHaveBeenCalledTimes(2);
      expect(audioUploadService.enqueueUpload).toHaveBeenCalledWith(
        'capture-1',
        '/audio/1.m4a',
        10000,
      );
      expect(audioUploadService.enqueueUpload).toHaveBeenCalledWith(
        'capture-3',
        '/audio/3.m4a',
        20000,
      );
    });

    it('should continue processing if one upload fails to enqueue', async () => {
      const mockCaptures = [
        { id: 'capture-1', type: 'audio', raw_content: '/audio/1.m4a', file_size: 10000 },
        { id: 'capture-2', type: 'audio', raw_content: '/audio/2.m4a', file_size: 20000 },
      ];

      (database.execute as jest.Mock).mockReturnValue({
        rows: mockCaptures,
      });

      // First enqueue fails, second succeeds
      audioUploadService.enqueueUpload
        .mockResolvedValueOnce({
          type: RepositoryResultType.DATABASE_ERROR,
          error: 'Database error',
        })
        .mockResolvedValueOnce({
          type: RepositoryResultType.SUCCESS,
          data: { uploadId: 'upload-2' },
        });

      eventBus.publish({
        type: 'SyncSuccess',
        timestamp: Date.now(),
        payload: { syncedCaptureIds: ['capture-1', 'capture-2'] },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Both should be attempted
      expect(audioUploadService.enqueueUpload).toHaveBeenCalledTimes(2);
    });

    it('should handle empty syncedCaptureIds gracefully', async () => {
      eventBus.publish({
        type: 'SyncSuccess',
        timestamp: Date.now(),
        payload: { syncedCaptureIds: [] },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // No database query if no captures synced
      expect(database.execute).not.toHaveBeenCalled();
      expect(audioUploadService.enqueueUpload).not.toHaveBeenCalled();
    });

    it('should handle database query errors gracefully', async () => {
      (database.execute as jest.Mock).mockImplementation(() => {
        throw new Error('Database connection lost');
      });

      eventBus.publish({
        type: 'SyncSuccess',
        timestamp: Date.now(),
        payload: { syncedCaptureIds: ['capture-1'] },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not crash, error logged
      expect(audioUploadService.enqueueUpload).not.toHaveBeenCalled();
    });
  });

  describe('Integration with EventBus', () => {
    it('should ignore non-SyncSuccess events', async () => {
      eventBus.publish({
        type: 'CaptureRecorded',
        timestamp: Date.now(),
        payload: { captureId: 'capture-1' },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(audioUploadService.enqueueUpload).not.toHaveBeenCalled();
    });

    it('should handle multiple SyncSuccess events sequentially', async () => {
      (database.execute as jest.Mock).mockReturnValue({
        rows: [
          { id: 'capture-1', type: 'audio', raw_content: '/audio/1.m4a', file_size: 10000 },
        ],
      });

      audioUploadService.enqueueUpload.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { uploadId: 'upload-x' },
      });

      // Publish 3 SyncSuccess events
      eventBus.publish({
        type: 'SyncSuccess',
        timestamp: Date.now(),
        payload: { syncedCaptureIds: ['capture-1'] },
      });

      eventBus.publish({
        type: 'SyncSuccess',
        timestamp: Date.now(),
        payload: { syncedCaptureIds: ['capture-1'] },
      });

      eventBus.publish({
        type: 'SyncSuccess',
        timestamp: Date.now(),
        payload: { syncedCaptureIds: ['capture-1'] },
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      // All 3 events should be processed
      expect(audioUploadService.enqueueUpload).toHaveBeenCalledTimes(3);
    });
  });
});
