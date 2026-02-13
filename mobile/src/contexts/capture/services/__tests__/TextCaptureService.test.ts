/**
 * TextCaptureService Tests
 *
 * Tests for AC2: Save Text Capture with Metadata
 * - Text validation (empty, whitespace-only)
 * - Capture entity creation with type='text'
 * - Metadata generation
 *
 * Story: 2.2 - Capture Texte Rapide
 */

import { TextCaptureService } from '../TextCaptureService';
import { ICaptureRepository } from '../../domain/ICaptureRepository';
import { RepositoryResultType } from '../../domain/Result';
import { Capture, CAPTURE_TYPES, CAPTURE_STATES } from '../../domain/Capture.model';

// Mock repository
const mockRepository: jest.Mocked<ICaptureRepository> = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByState: jest.fn(),
  findBySyncStatus: jest.fn(),
  findAll: jest.fn(),
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
        state: CAPTURE_STATES.CAPTURED,
        rawContent: 'Ma pensée',
        capturedAt: new Date(),
        syncStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: mockCapture,
      });

      const result = await service.createTextCapture('  Ma pensée  ');

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(mockRepository.create).toHaveBeenCalledWith({
        type: CAPTURE_TYPES.TEXT,
        state: CAPTURE_STATES.CAPTURED,
        rawContent: 'Ma pensée',
        normalizedText: 'Ma pensée',
        syncStatus: 'pending',
      });
    });

    it('should create Capture entity with type=text', async () => {
      const mockCapture: Capture = {
        id: 'test-id',
        type: CAPTURE_TYPES.TEXT,
        state: CAPTURE_STATES.CAPTURED,
        rawContent: 'Ma pensée importante',
        capturedAt: new Date(),
        syncStatus: 'pending',
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

    it('should set syncStatus to pending for offline support', async () => {
      const mockCapture: Capture = {
        id: 'test-id',
        type: CAPTURE_TYPES.TEXT,
        state: CAPTURE_STATES.CAPTURED,
        rawContent: 'Offline text',
        capturedAt: new Date(),
        syncStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: mockCapture,
      });

      const result = await service.createTextCapture('Offline text');

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          syncStatus: 'pending',
        })
      );
    });
  });
});
