/**
 * TextCaptureService Tests
 *
 * Tests for AC2: Save Text Capture with Metadata
 * - Text validation (empty, whitespace-only)
 * - Capture entity creation with type='text'
 * - Metadata generation
 *
 * Story: 2.2 - Capture Texte Rapide
 * Updated: Story 16.2 — state=READY, normalizedText=rawContent
 */

import { TextCaptureService } from '../TextCaptureService';
import { ICaptureRepository } from '../../domain/ICaptureRepository';
import { RepositoryResultType } from '../../domain/Result';
import { Capture, CAPTURE_TYPES, CAPTURE_STATES } from '../../domain/Capture.model';

// Mock repository — aligned with ICaptureRepository interface
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

describe('TextCaptureService', () => {
  let service: TextCaptureService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TextCaptureService(mockRepository);
  });

  describe('createTextCapture', () => {
    it('should validate empty text', async () => {
      const result = await service.createTextCapture('');

      expect(result.type).toBe(RepositoryResultType.VALIDATION_ERROR);
      expect(result.error).toBe('EmptyText');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should validate whitespace-only text', async () => {
      const result = await service.createTextCapture('   ');

      expect(result.type).toBe(RepositoryResultType.VALIDATION_ERROR);
      expect(result.error).toBe('EmptyText');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should trim text before saving', async () => {
      const mockCapture: Capture = {
        id: 'test-id',
        type: CAPTURE_TYPES.TEXT,
        state: CAPTURE_STATES.READY,
        rawContent: 'Ma pensée',
        normalizedText: 'Ma pensée',
        capturedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: mockCapture,
      });

      const result = await service.createTextCapture('  Ma pensée  ');

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      // Story 16.2: state=READY, normalizedText=rawContent — syncStatus géré en interne
      expect(mockRepository.create).toHaveBeenCalledWith({
        type: CAPTURE_TYPES.TEXT,
        state: CAPTURE_STATES.READY,
        rawContent: 'Ma pensée',
        normalizedText: 'Ma pensée',
      });
    });

    it('should create Capture entity with type=text and state=READY', async () => {
      const mockCapture: Capture = {
        id: 'test-id',
        type: CAPTURE_TYPES.TEXT,
        state: CAPTURE_STATES.READY,
        rawContent: 'Ma pensée importante',
        normalizedText: 'Ma pensée importante',
        capturedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: mockCapture,
      });

      const result = await service.createTextCapture('Ma pensée importante');

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe('test-id');
      expect(result.data?.type).toBe(CAPTURE_TYPES.TEXT);
      expect(result.data?.rawContent).toBe('Ma pensée importante');
    });

    it('should handle repository errors', async () => {
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.UNKNOWN_ERROR,
        error: 'Database error',
      });

      const result = await service.createTextCapture('Valid text');

      expect(result.type).toBe(RepositoryResultType.UNKNOWN_ERROR);
      expect(result.error).toBe('Database error');
    });

    it('should pass normalizedText equal to rawContent for offline-first support', async () => {
      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { id: 'test-id' } as Capture,
      });

      await service.createTextCapture('Offline text');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          normalizedText: 'Offline text',
          rawContent: 'Offline text',
        })
      );
    });
  });
});
