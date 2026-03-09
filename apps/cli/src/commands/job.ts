import { Cli, z } from 'incur'
import { getClient } from '../orpc-client.ts'
import { globalOptions } from '../utils.ts'

// Since solid-imager does not currently expose a generic job router via oRPC,
// we will output a NOT_IMPLEMENTED error for now, but keep the structure fully typed
// using a placeholder approach or generic catch.

export const jobCmd = Cli.create('job', { description: 'Background job management' })
  .command('list', {
    description: 'List active or recent jobs',
    options: globalOptions.extend({
      limit: z.coerce.number().default(20),
      offset: z.coerce.number().default(0),
      status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']).optional().describe('Filter by status'),
      type: z.string().optional().describe('Filter by job type'),
    }),
    async run(c) {
      // NOTE: solid-imager API doesn't have a public job router exposed via appRouter yet.
      return c.error({ code: 'NOT_IMPLEMENTED', message: 'Job API is not exposed via oRPC yet on the server.' })
    }
  })
  .command('retry', {
    description: 'Retry a failed job',
    args: z.object({ id: z.string() }),
    options: globalOptions,
    async run(c) {
      return c.error({ code: 'NOT_IMPLEMENTED', message: 'Job retry API is not exposed via oRPC yet on the server.' })
    }
  })
  .command('clear', {
    description: 'Clear completed or failed jobs from history',
    options: globalOptions.extend({
      status: z.enum(['completed', 'failed']).default('completed'),
    }),
    async run(c) {
      return c.error({ code: 'NOT_IMPLEMENTED', message: 'Job clear API is not exposed via oRPC yet on the server.' })
    }
  })
