/**
 * Data Factory: Capture
 *
 * Generates test data for Capture entities using faker
 * Follows factory pattern from knowledge base (data-factories.md)
 *
 * Usage:
 *   const factory = createCaptureFactory(database);
 *   const capture = await factory.create({ type: 'audio' });
 */

import { faker } from '@faker-js/faker';
import { Database } from '@nozbe/watermelondb';
import { Capture } from '@/contexts/Capture/domain/Capture.model';

type CaptureType = 'audio' | 'text' | 'image' | 'url';
type CaptureState = 'captured' | 'processing' | 'ready' | 'failed' | 'recording';
type SyncStatus = 'pending' | 'synced';

export interface CaptureFactoryData {
  type?: CaptureType;
  state?: CaptureState;
  rawContent?: string | null;
  normalizedText?: string | null;
  capturedAt?: Date;
  location?: { latitude: number; longitude: number } | null;
  tags?: string[];
  syncStatus?: SyncStatus;
  projectId?: string | null;
}

/**
 * Create Capture factory with database context
 */
export const createCaptureFactory = (database: Database) => {
  /**
   * Generate random Capture data (pure function)
   */
  const generateCaptureData = (overrides: CaptureFactoryData = {}): CaptureFactoryData => {
    const type = overrides.type || faker.helpers.arrayElement(['audio', 'text', 'image', 'url'] as CaptureType[]);

    // Generate realistic rawContent based on type
    const rawContent = overrides.rawContent !== undefined
      ? overrides.rawContent
      : generateRawContent(type);

    return {
      type,
      state: overrides.state || 'captured',
      rawContent,
      normalizedText: overrides.normalizedText || (type === 'audio' ? faker.lorem.sentence() : null),
      capturedAt: overrides.capturedAt || faker.date.recent({ days: 7 }),
      location: overrides.location !== undefined
        ? overrides.location
        : faker.datatype.boolean()
          ? {
              latitude: parseFloat(faker.location.latitude()),
              longitude: parseFloat(faker.location.longitude()),
            }
          : null,
      tags: overrides.tags || faker.helpers.arrayElements(
        ['work', 'personal', 'idea', 'todo', 'meeting', 'project'],
        { min: 0, max: 3 }
      ),
      syncStatus: overrides.syncStatus || 'pending',
      projectId: overrides.projectId !== undefined ? overrides.projectId : null,
    };
  };

  /**
   * Generate realistic rawContent based on capture type
   */
  const generateRawContent = (type: CaptureType): string => {
    switch (type) {
      case 'audio':
        // Generate realistic file path
        const userId = faker.string.uuid();
        const timestamp = Date.now();
        const uuid = faker.string.uuid();
        return `file://documents/capture_${userId}_${timestamp}_${uuid}.m4a`;

      case 'text':
        return faker.lorem.paragraphs(2);

      case 'image':
        return `file://documents/capture_${faker.string.uuid()}.jpg`;

      case 'url':
        return faker.internet.url();

      default:
        return '';
    }
  };

  /**
   * Create Capture entity in database
   */
  const create = async (overrides: CaptureFactoryData = {}): Promise<Capture> => {
    const data = generateCaptureData(overrides);

    return await database.write(async () => {
      return await database.get<Capture>('captures').create((record) => {
        record.type = data.type!;
        record.state = data.state!;
        record.rawContent = data.rawContent;
        record.normalizedText = data.normalizedText;
        record.capturedAt = data.capturedAt!;
        record.syncStatus = data.syncStatus!;
        // Note: location, tags, projectId might require special handling
        // depending on WatermelonDB schema (relations, JSON fields, etc.)
      });
    });
  };

  /**
   * Create multiple Capture entities
   */
  const createMany = async (count: number, overrides: CaptureFactoryData = {}): Promise<Capture[]> => {
    const captures: Capture[] = [];
    for (let i = 0; i < count; i++) {
      captures.push(await create(overrides));
    }
    return captures;
  };

  /**
   * Create audio capture specifically (convenience method)
   */
  const createAudioCapture = async (overrides: Partial<CaptureFactoryData> = {}): Promise<Capture> => {
    return await create({
      ...overrides,
      type: 'audio',
    });
  };

  /**
   * Create recording capture (state: 'recording')
   */
  const createRecordingCapture = async (overrides: Partial<CaptureFactoryData> = {}): Promise<Capture> => {
    return await create({
      ...overrides,
      type: 'audio',
      state: 'recording',
      rawContent: null, // Not yet saved
    });
  };

  /**
   * Create pending sync capture
   */
  const createPendingCapture = async (overrides: Partial<CaptureFactoryData> = {}): Promise<Capture> => {
    return await create({
      ...overrides,
      syncStatus: 'pending',
    });
  };

  /**
   * Generate data only (no database write)
   */
  const build = (overrides: CaptureFactoryData = {}): CaptureFactoryData => {
    return generateCaptureData(overrides);
  };

  /**
   * Generate multiple data objects (no database write)
   */
  const buildMany = (count: number, overrides: CaptureFactoryData = {}): CaptureFactoryData[] => {
    return Array.from({ length: count }, () => generateCaptureData(overrides));
  };

  // Return factory API
  return {
    create,
    createMany,
    createAudioCapture,
    createRecordingCapture,
    createPendingCapture,
    build,
    buildMany,
  };
};

/**
 * Cleanup helper (for fixture auto-cleanup)
 */
export const deleteCaptureById = async (database: Database, captureId: string): Promise<void> => {
  await database.write(async () => {
    const capture = await database.get<Capture>('captures').find(captureId);
    await capture.destroyPermanently();
  });
};

/**
 * Cleanup all captures (for test teardown)
 */
export const deleteAllCaptures = async (database: Database): Promise<void> => {
  await database.write(async () => {
    const captures = await database.get<Capture>('captures').query().fetch();
    await Promise.all(captures.map((c) => c.destroyPermanently()));
  });
};
