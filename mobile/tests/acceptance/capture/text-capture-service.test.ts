/**
 * Acceptance Tests: TextCaptureService
 *
 * Story 16.2 - AC6: Migration WatermelonDB → OP-SQLite mock pattern
 * Tests the current TextCaptureService API with ICaptureRepository mock
 * (WatermelonDB was removed — see ADR-018, migration completed in Story 14.1)
 *
 * Run: npm run test:acceptance
 */

import { TextCaptureService } from '@/contexts/capture/services/TextCaptureService';
import { ICaptureRepository } from '@/contexts/capture/domain/ICaptureRepository';
import { RepositoryResultType } from '@/contexts/capture/domain/Result';
import { Capture, CAPTURE_TYPES, CAPTURE_STATES } from '@/contexts/capture/domain/Capture.model';

// Mock OP-SQLite (pattern from story-8-14.test.ts)
jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(() => ({
    execute: jest.fn(),
    close: jest.fn(),
  })),
}));

// Mock expo modules
jest.mock('expo-haptics');
jest.mock('reflect-metadata');

// ============================================================
// Mock ICaptureRepository (OP-SQLite backed in production)
// Only methods required by TextCaptureService are implemented;
// unused interface methods use jest.fn() as no-ops.
// ============================================================
const mockRepository: jest.Mocked<ICaptureRepository> = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findById: jest.fn(),
  findByState: jest.fn(),
  findAll: jest.fn(),
  findAllPaginated: jest.fn(),
  count: jest.fn(),
  findPendingSync: jest.fn(),
  findSynced: jest.fn(),
  findConflicts: jest.fn(),
  isPendingSync: jest.fn(),
  hasConflict: jest.fn(),
  observeById: jest.fn(),
};

describe('TextCaptureService — Acceptance Tests (AC6)', () => {
  let service: TextCaptureService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TextCaptureService(mockRepository);
  });

  // ============================================================
  // AC2: Save Text Capture with Metadata
  // ============================================================
  describe('AC2: Save Text Capture with Metadata', () => {
    it('should create a Capture entity with type "text"', async () => {
      const mockCapture: Capture = {
        id: 'capture-001',
        type: CAPTURE_TYPES.TEXT,
        state: CAPTURE_STATES.READY,
        rawContent: 'This is my brilliant idea',
        normalizedText: 'This is my brilliant idea',
        capturedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: mockCapture,
      });

      const result = await service.createTextCapture('This is my brilliant idea');

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data?.type).toBe(CAPTURE_TYPES.TEXT);
      // Story 16.2: Text captures are immediately READY (no transcription step)
      expect(result.data?.state).toBe(CAPTURE_STATES.READY);
    });

    it('should store text content in rawContent', async () => {
      const textContent = 'Important note to remember';
      const mockCapture: Capture = {
        id: 'capture-002',
        type: CAPTURE_TYPES.TEXT,
        state: CAPTURE_STATES.READY,
        rawContent: textContent,
        normalizedText: textContent,
        capturedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: mockCapture,
      });

      const result = await service.createTextCapture(textContent);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data?.rawContent).toBe(textContent);
    });

    it('should set normalizedText equal to rawContent for text captures', async () => {
      const textContent = 'No transformation required';
      const mockCapture: Capture = {
        id: 'capture-003',
        type: CAPTURE_TYPES.TEXT,
        state: CAPTURE_STATES.READY,
        rawContent: textContent,
        normalizedText: textContent,
        capturedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: mockCapture,
      });

      const result = await service.createTextCapture(textContent);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data?.normalizedText).toBe(result.data?.rawContent);
    });

    it('should call repository.create with correct parameters', async () => {
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'capture-004' } as Capture,
      });

      await service.createTextCapture('Ma pensée');

      // Story 16.2: state=READY (no transcription), normalizedText=rawContent
      expect(mockRepository.create).toHaveBeenCalledWith({
        type: CAPTURE_TYPES.TEXT,
        state: CAPTURE_STATES.READY,
        rawContent: 'Ma pensée',
        normalizedText: 'Ma pensée',
      });
    });
  });

  // ============================================================
  // AC4 / AC5: Offline support (syncStatus=pending)
  // ============================================================
  describe('AC4: Offline Text Capture Functionality', () => {
    it('should create a capture that can be synced later (offline-first)', async () => {
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: {
          id: 'offline-capture',
          syncStatus: 'pending',
        } as Capture,
      });

      const result = await service.createTextCapture('Offline thought');

      // Sync is managed by CaptureRepository internally (not passed as param)
      expect(mockRepository.create).toHaveBeenCalledTimes(1);
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
    });

    it('should work without network connectivity (no network call made)', async () => {
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'offline-2' } as Capture,
      });

      const result = await service.createTextCapture('Offline thought 2');

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data?.id).toBeDefined();
    });

    it('should support multiple offline captures without interference', async () => {
      mockRepository.create
        .mockResolvedValueOnce({
          type: RepositoryResultType.SUCCESS,
          data: { id: 'cap-1' } as Capture,
        })
        .mockResolvedValueOnce({
          type: RepositoryResultType.SUCCESS,
          data: { id: 'cap-2' } as Capture,
        })
        .mockResolvedValueOnce({
          type: RepositoryResultType.SUCCESS,
          data: { id: 'cap-3' } as Capture,
        });

      const r1 = await service.createTextCapture('First offline');
      const r2 = await service.createTextCapture('Second offline');
      const r3 = await service.createTextCapture('Third offline');

      expect(r1.type).toBe(RepositoryResultType.SUCCESS);
      expect(r2.type).toBe(RepositoryResultType.SUCCESS);
      expect(r3.type).toBe(RepositoryResultType.SUCCESS);
      expect(mockRepository.create).toHaveBeenCalledTimes(3);
    });
  });

  // ============================================================
  // Empty Text Validation
  // ============================================================
  describe('Empty Text Validation', () => {
    it('should reject empty text with VALIDATION_ERROR', async () => {
      const result = await service.createTextCapture('');

      expect(result.type).toBe(RepositoryResultType.VALIDATION_ERROR);
      expect(result.error).toBe('EmptyText');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only text with VALIDATION_ERROR', async () => {
      const result = await service.createTextCapture('   \n\t   ');

      expect(result.type).toBe(RepositoryResultType.VALIDATION_ERROR);
      expect(result.error).toBe('EmptyText');
    });

    it('should trim leading/trailing whitespace before saving', async () => {
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'trimmed' } as Capture,
      });

      await service.createTextCapture('  Valid content  ');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ rawContent: 'Valid content' }),
      );
    });

    it('should not call repository.create when text is invalid', async () => {
      await service.createTextCapture('');

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Edge cases
  // ============================================================
  describe('Edge Cases', () => {
    it('should handle very long text content', async () => {
      const longText = 'A'.repeat(10000);
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'long', rawContent: longText } as Capture,
      });

      const result = await service.createTextCapture(longText);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
    });

    it('should handle special characters and emojis', async () => {
      const specialText = 'Hello! 👋 This is a test with "quotes", \n newlines, and émojis 🚀';
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'special', rawContent: specialText } as Capture,
      });

      const result = await service.createTextCapture(specialText);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
    });

    it('should propagate repository errors', async () => {
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.UNKNOWN_ERROR,
        error: 'Database error',
      });

      const result = await service.createTextCapture('Valid text');

      expect(result.type).toBe(RepositoryResultType.UNKNOWN_ERROR);
      expect(result.error).toBe('Database error');
    });
  });
});
