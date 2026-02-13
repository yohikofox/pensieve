/**
 * Text Capture Service - Text Capture Business Logic
 *
 * Handles text capture creation with validation
 *
 * Features:
 * - AC2: Save Text Capture with Metadata
 * - AC5: Empty Text Validation
 * - AC4: Offline support (syncStatus=pending)
 *
 * Story: 2.2 - Capture Texte Rapide
 *
 * Architecture: Uses TSyringe IoC for dependency injection
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../../infrastructure/di/tokens';
import { type ICaptureRepository } from '../domain/ICaptureRepository';
import { type RepositoryResult, RepositoryResultType } from '../domain/Result';
import { type Capture, CAPTURE_TYPES, CAPTURE_STATES } from '../domain/Capture.model';

/**
 * TextCaptureService manages text capture creation
 *
 * Usage pattern with TSyringe:
 * ```typescript
 * import { container } from 'tsyringe';
 * const service = container.resolve(TextCaptureService);
 * const result = await service.createTextCapture('Ma pensée');
 * ```
 */
@injectable()
export class TextCaptureService {
  constructor(
    @inject(TOKENS.ICaptureRepository) private repository: ICaptureRepository
  ) {}

  /**
   * AC2: Save Text Capture with Metadata
   * AC5: Empty Text Validation
   *
   * Creates a Capture entity with type='text'
   *
   * @param text - User input text
   * @returns Result with created Capture
   */
  async createTextCapture(text: string): Promise<RepositoryResult<Capture>> {
    // AC5: Empty text validation
    const trimmedText = text.trim();

    if (!trimmedText) {
      return {
        type: RepositoryResultType.VALIDATION_ERROR,
        error: 'EmptyText',
      };
    }

    // AC2: Create Capture entity with type='text'
    // AC4: Set syncStatus='pending' for offline support
    // For text captures, normalizedText = rawContent (no transcription/processing needed)
    const result = await this.repository.create({
      type: CAPTURE_TYPES.TEXT,
      state: CAPTURE_STATES.CAPTURED,
      rawContent: trimmedText,
      normalizedText: trimmedText,
      syncStatus: 'pending',
    });

    return result;
  }
}
