#!/usr/bin/env bun
import { Cli, z } from 'incur'
import { getClient } from './orpc-client.ts'
import { mediaCmd } from './commands/media.ts'
import { jobCmd } from './commands/job.ts'
import { aiCmd } from './commands/ai.ts'
import { dbCmd } from './commands/db.ts'

const globalOptions = z.object({
  remote: z.string().default('http://localhost:3000').describe('Remote server URL (e.g. http://localhost:3000)'),
})

const cli = Cli.create('imager-cli', {
  description: 'Solid Imager Management CLI',
})

cli.command('ping', {
  description: 'Ping the remote server',
  options: globalOptions,
  async run(c) {
    try {
      const rpc = getClient(c.options.remote)
      const config = await rpc.config.getConfig()
      return { status: 'ok', remote: c.options.remote, config }
    } catch (e: any) {
      return { error: 'CONNECTION_ERROR', message: `Failed to connect to ${c.options.remote}: ${e.message}` }
    }
  }
})

cli.command(mediaCmd)
cli.command(jobCmd)
cli.command(aiCmd)
cli.command(dbCmd)

cli.serve()
