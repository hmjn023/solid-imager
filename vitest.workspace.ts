import { defineWorkspace } from 'vite-plus';

export default defineWorkspace([
  'apps/cli/vitest.config.ts',
  'apps/server/vitest.unit.config.ts',
  'apps/server/vitest.integration.config.ts',
  'packages/core/vitest.config.ts'
]);
