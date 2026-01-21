import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from './schema';
import { migrations } from './migrations';
import { Capture } from '../contexts/capture/domain/Capture.model';

// Initialize SQLite adapter
const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'pensine',
  jsi: true, // Use JSI for better performance (requires Expo custom dev client)
  onSetUpError: (error) => {
    console.error('WatermelonDB setup error:', error);
  },
});

// Create database instance
export const database = new Database({
  adapter,
  modelClasses: [
    Capture,
    // TODO: Register additional models here as they are created
    // Example: KnowledgeModel, etc.
  ],
});
