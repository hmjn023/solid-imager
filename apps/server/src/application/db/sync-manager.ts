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
   * Internal common sync logic
   */
  performSync: async (options: { forceInitDb?: boolean } = {}) => {
    if (isSyncing()) return;

    try {
      setIsSyncing(true);

      if (options.forceInitDb) {
        // Initialize local DB connection
        await getLocalDb();
      }

      // Force refetch on all collections (this populates local PGLite cache)
      await sharedQueryClient.fetchQuery({ queryKey: ['presets'] });

      setLastSyncTime(new Date());
    } catch (error) {
      logger.error({ error }, 'Sync failed');
      throw error;
    } finally {
      setIsSyncing(false);
    }
  },

  /**
   * Initialize collections and force an initial sync
   */
  init: async () => {
    try {
      await SyncManager.performSync({ forceInitDb: true });
      logger.info('Initial sync completed.');
    } catch (error) {
      // Error is already logged in performSync
    }
  },

  /**
   * Manually trigger a full sync with the backend
   */
  syncAll: async () => {
    await SyncManager.performSync();
  }
};
