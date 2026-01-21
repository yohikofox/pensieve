import {
  schemaMigrations,
  addColumns,
} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      // Task 3: Audio File Storage Management
      // Add metadata fields for audio captures
      toVersion: 2,
      steps: [
        addColumns({
          table: 'captures',
          columns: [
            { name: 'duration', type: 'number', isOptional: true },
            { name: 'file_size', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
