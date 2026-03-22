import { createCollection } from '@tanstack/solid-db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { orpc } from '~/infrastructure/api-clients/orpc-client';
import { getLocalDb } from '../local-db';
import { logger } from '~/infrastructure/logger';
import { QueryClient } from '@tanstack/solid-query';
import type { Preset } from '@core/domain/media/schemas';

// Shared query client for TanStack DB collections
export const sharedQueryClient = new QueryClient();

export const presetsCollection = createCollection<Preset>(
  queryCollectionOptions({
    id: 'presets',
    queryClient: sharedQueryClient,
    queryKey: ['presets'],
    queryFn: async () => {
      const response = await orpc.presets.list();

      try {
        const db = await getLocalDb();
        await db.query('BEGIN');

        // Optimized bulk upsert using PostgreSQL's unnest for better performance
        // This avoids individual INSERT statements in a loop
        const ids = response.map(p => p.id);
        const names = response.map(p => p.name);
        const values = response.map(p => JSON.stringify(p.value));
        const sorts = response.map(p => p.sort || null);
        const orders = response.map(p => p.order || null);
        const modes = response.map(p => p.mode || null);
        const createdAts = response.map(p => p.createdAt);

        await db.query(`
          INSERT INTO presets (id, name, value, sort, display_order, mode, created_at)
          SELECT * FROM UNNEST($1::int[], $2::text[], $3::jsonb[], $4::text[], $5::text[], $6::text[], $7::timestamp[])
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            value = EXCLUDED.value,
            sort = EXCLUDED.sort,
            display_order = EXCLUDED.display_order,
            mode = EXCLUDED.mode,
            created_at = EXCLUDED.created_at;
        `, [ids, names, values, sorts, orders, modes, createdAts]);

        await db.query('COMMIT');
      } catch (error) {
        logger.error({ error }, 'Failed to update local presets cache');
      }

      return response as Preset[];
    },
    getKey: (item: Preset) => String(item.id),

    onInsert: async ({ transaction }) => {
      const { modified: newPreset } = transaction.mutations[0];

      try {
        const createdPreset = await orpc.presets.create({
          name: newPreset.name,
          value: newPreset.value,
          sort: newPreset.sort || undefined,
          order: newPreset.order || undefined,
          mode: newPreset.mode || undefined,
        });

        return createdPreset as Preset;
      } catch (error) {
        logger.error({ error }, 'Failed to create preset on backend');
        throw error;
      }
    },

    onUpdate: async ({ transaction }) => {
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

        return updatedPreset as Preset;
      } catch (error) {
        logger.error({ error }, 'Failed to update preset on backend');
        throw error;
      }
    },

    onDelete: async ({ transaction }) => {
      const { original } = transaction.mutations[0];

      try {
        await orpc.presets.delete({ id: Number(original.id) });
      } catch (error) {
        logger.error({ error }, 'Failed to delete preset on backend');
        throw error;
      }
    },
  })
);
