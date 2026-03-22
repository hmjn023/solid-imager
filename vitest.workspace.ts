import { defineWorkspace } from 'vite-plus';

export default defineWorkspace([
  'apps/*/vitest.config.ts',
  'apps/*/vitest.*.config.ts',
  'packages/*/vitest.config.ts'
]);
