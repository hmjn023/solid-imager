import { Cli, z } from 'incur'
import { getClient } from '../orpc-client.ts'

const globalOptions = z.object({
  remote: z.string().default('http://localhost:3000').describe('Remote server URL'),
})

export const aiCmd = Cli.create('ai', { description: 'AI processing tools' })
  .command('tag', {
    description: 'Trigger AI tagging for a remote media file',
    args: z.object({ mediaId: z.string() }),
    options: globalOptions.extend({
      mediaSourceId: z.string().describe('The source ID of the media (required by API)'),
    }),
    async run(c) {
      const rpc = getClient(c.options.remote)
      try {
        const result = await rpc.ai.tag({
           mediaId: c.args.mediaId,
           mediaSourceId: c.options.mediaSourceId
        })
        return c.ok({ result })
      } catch (e: any) {
        return c.error({ code: 'AI_ERROR', message: e.message })
      }
    }
  })
  .command('status', {
    description: 'Check AI service health',
    options: globalOptions,
    async run(c) {
      try {
        // The bun server proxies /api/ai/health or we can just ping the config
        const res = await fetch(new URL('/api/ai/health', c.options.remote).toString()).catch(() => null)
        if (res && res.ok) {
           return c.ok({ status: 'online', details: await res.json().catch(() => 'ok') })
        }
        return c.error({ code: 'OFFLINE', message: 'AI service appears offline or unreachable.' })
      } catch (e: any) {
        return c.error({ code: 'FETCH_ERROR', message: e.message })
      }
    }
  })
