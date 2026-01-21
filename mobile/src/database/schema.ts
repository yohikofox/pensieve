import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 2, // Incremented for metadata fields
  tables: [
    tableSchema({
      name: 'captures',
      columns: [
        { name: 'type', type: 'string' }, // 'audio' | 'text' | 'image' | 'url'
        { name: 'state', type: 'string' }, // 'captured' | 'processing' | 'ready' | 'failed' | 'recording'
        { name: 'project_id', type: 'string', isOptional: true }, // Nullable for orphaned captures
        { name: 'raw_content', type: 'string' }, // File path for audio/image, text content, or URL
        { name: 'normalized_text', type: 'string', isOptional: true }, // Set after transcription
        { name: 'captured_at', type: 'number' }, // Timestamp
        { name: 'location', type: 'string', isOptional: true }, // JSON GeoPoint
        { name: 'tags', type: 'string', isOptional: true }, // JSON string array
        { name: 'sync_status', type: 'string' }, // 'pending' | 'synced'
        { name: 'duration', type: 'number', isOptional: true }, // Audio duration in milliseconds
        { name: 'file_size', type: 'number', isOptional: true }, // File size in bytes
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
