import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    // TODO: Add migrations here as schema evolves
    // Example:
    // {
    //   toVersion: 2,
    //   steps: [
    //     addColumns({
    //       table: 'captures',
    //       columns: [
    //         { name: 'audio_url', type: 'string', isOptional: true },
    //       ],
    //     }),
    //   ],
    // },
  ],
});
