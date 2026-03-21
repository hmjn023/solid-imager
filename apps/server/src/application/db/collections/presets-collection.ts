import { createCollection } from '@tanstack/solid-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { orpc } from '~/infrastructure/api-clients/orpc-client';
import { getLocalDb } from '../local-db';
import { logger } from '~/infrastructure/logger';
import { QueryClient } from '@tanstack/solid-query';

// Shared query client for TanStack DB collections
export const sharedQueryClient = new QueryClient();

// biome-ignore lint/suspicious/noExplicitAny: Required for TanStack DB collection types
export const presetsCollection = createCollection<any>(
  queryCollectionOptions({
    id: 'presets',
    queryClient: sharedQueryClient,
    queryKey: ['presets'],
    queryFn: async () => {
      const response = await orpc.presets.list();

      try {
        const db = await getLocalDb();
        await db.query('BEGIN');

        await db.query(`
          CREATE TABLE IF NOT EXISTS presets (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            value JSONB NOT NULL,
            sort TEXT,
            "order" TEXT,
            mode TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);

        for (const preset of response) {
          await db.query(`
            INSERT INTO presets (id, name, value, sort, "order", mode, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              value = EXCLUDED.value,
              sort = EXCLUDED.sort,
              "order" = EXCLUDED."order",
              mode = EXCLUDED.mode,
              created_at = EXCLUDED.created_at;
          `, [
            preset.id,
            preset.name,
            JSON.stringify(preset.value),
            preset.sort,
            preset.order,
            preset.mode,
            preset.createdAt
          ]);
        }

        await db.query('COMMIT');
      } catch (error) {
        logger.error({ error }, 'Failed to update local presets cache');
      }

      return response;
    },
    // biome-ignore lint/suspicious/noExplicitAny: Required for TanStack DB collection types
    getKey: (item: any) => String(item.id),

    // biome-ignore lint/suspicious/noExplicitAny: Required for TanStack DB collection types
    onInsert: async ({ transaction }: any) => {
      const { modified: newPreset } = transaction.mutations[0];

      try {
        const createdPreset = await orpc.presets.create({
          name: newPreset.name,
          value: newPreset.value,
          sort: newPreset.sort || undefined,
          order: newPreset.order || undefined,
          mode: newPreset.mode || undefined,
        });

        return createdPreset;
      } catch (error) {
        logger.error({ error }, 'Failed to create preset on backend');
        throw error;
      }
    },

    // biome-ignore lint/suspicious/noExplicitAny: Required for TanStack DB collection types
    onUpdate: async ({ transaction }: any) => {
      const { original, modified } = transaction.mutations[0];

      try {
        const updatedPreset = await orpc.presets.update({
          id: Number(original.id),
          data: {
            name: modified.name,
            value: modified.value,
            sort: modified.sort || undefined,
            order: modified.order || undefined,
            mode: modified.mode || undefined,
          }
        });

        return updatedPreset;
      } catch (error) {
        logger.error({ error }, 'Failed to update preset on backend');
        throw error;
      }
    },

    // biome-ignore lint/suspicious/noExplicitAny: Required for TanStack DB collection types
    onDelete: async ({ transaction }: any) => {
      const { original } = transaction.mutations[0];

      try {
        await orpc.presets.delete({ id: Number(original.id) });
      } catch (error) {
        logger.error({ error }, 'Failed to delete preset on backend');
        throw error;
      }
    },
  // biome-ignore lint/suspicious/noExplicitAny: Required for TanStack DB collection types
  }) as any
);
