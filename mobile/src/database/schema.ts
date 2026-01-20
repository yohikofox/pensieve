import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    // TODO: Add tables here as we implement bounded contexts
    // Example for future reference:
    // tableSchema({
    //   name: 'captures',
    //   columns: [
    //     { name: 'title', type: 'string' },
    //     { name: 'content', type: 'string' },
    //     { name: 'created_at', type: 'number' },
    //     { name: 'updated_at', type: 'number' },
    //   ],
    // }),
  ],
});
