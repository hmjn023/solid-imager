import { getLocalDb } from './local-db';
import { sharedQueryClient } from './collections/presets-collection';
import { createSignal } from 'solid-js';
import { logger } from '~/infrastructure/logger';

// Global sync state to show status in UI
export const [isSyncing, setIsSyncing] = createSignal(false);
export const [lastSyncTime, setLastSyncTime] = createSignal<Date | null>(null);

/**
 * SyncManager manages syncing between the local PGLite database and the backend API
 * through TanStack DB collections.
 */
export const SyncManager = {
  /**
   * Initialize collections and force an initial sync
   */
  init: async () => {
    try {
      setIsSyncing(true);

      // Initialize local DB connection
      await getLocalDb();

      // Force fetching collections (this populates local PGLite cache)
      // Since fetch might not be directly exposed, we use the query client
      await sharedQueryClient.fetchQuery({ queryKey: ['presets'] });

      setLastSyncTime(new Date());
      logger.info('Initial sync completed.');
    } catch (error) {
      logger.error({ error }, 'Initial sync failed');
    } finally {
      setIsSyncing(false);
    }
  },

  /**
   * Manually trigger a full sync with the backend
   */
  syncAll: async () => {
    try {
      setIsSyncing(true);

      // Force refetch on all collections
      await sharedQueryClient.fetchQuery({ queryKey: ['presets'] });

      setLastSyncTime(new Date());
    } catch (error) {
      logger.error({ error }, 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }
};
