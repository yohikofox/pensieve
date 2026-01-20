import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from './schema';
import { migrations } from './migrations';

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
    // TODO: Register models here as they are created
    // Example: CaptureModel, KnowledgeModel, etc.
  ],
});
