import { Cli, z } from 'incur'
import { getClient } from '../orpc-client.ts'
import fs from 'node:fs/promises'
import path from 'node:path'

const globalOptions = z.object({
  remote: z.string().default('http://localhost:3000').describe('Remote server URL'),
})

export const getHandler = async (c: any) => {
  const rpc = getClient(c.options.remote)
  try {
    const media = await rpc.media.get({ id: c.args.id })
    return c.ok({ media })
  } catch (e: any) {
    return c.error({ code: 'FETCH_ERROR', message: e.message })
  }
}

export const searchHandler = async (c: any) => {
  const rpc = getClient(c.options.remote)
  try {
    const result = await rpc.media.list({
      limit: c.options.limit,
      offset: c.options.offset,
      query: c.options.query,
      sort: 'date_desc',
    })
    return c.ok({ total: result.total, items: result.items })
  } catch (e: any) {
    return c.error({ code: 'FETCH_ERROR', message: e.message })
  }
}

export const viewHandler = async (c: any) => {
  try {
    const rpc = getClient(c.options.remote)
    const media = await rpc.media.get({ id: c.args.id })

    const url = new URL(`/api/media/${media.id}/original`, c.options.remote).toString()
    const res = await fetch(url)
    if (!res.ok) {
      return c.error({ code: 'FETCH_ERROR', message: `Failed to fetch image binary: ${res.statusText} (${res.status})` })
    }

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')

    const name = Buffer.from(media.originalFileName || 'image').toString('base64')
    const width = c.options.width
    const height = c.options.height

    const escapeCode = `\x1b]1337;File=name=${name};size=${buffer.length};inline=1;width=${width};height=${height}:${base64}\x07`

    if (!c.agent) {
      process.stdout.write(escapeCode + '\n')
      return c.ok({ displayed: true })
    } else {
      return c.error({ code: 'VIEW_NOT_SUPPORTED', message: "Terminal image display is not supported in agent mode." })
    }
  } catch (e: any) {
    return c.error({ code: 'VIEW_ERROR', message: e.message })
  }
}

export const downloadHandler = async (c: any) => {
  try {
    const rpc = getClient(c.options.remote)
    const media = await rpc.media.get({ id: c.args.id })

    const url = new URL(`/api/media/${media.id}/original`, c.options.remote).toString()
    const res = await fetch(url)
    if (!res.ok) {
      return c.error({ code: 'FETCH_ERROR', message: `Failed to fetch media binary: ${res.statusText} (${res.status})` })
    }

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let filename = c.options.output
    if (!filename) {
      filename = media.originalFileName || `${media.id}.bin`
    }

    await fs.writeFile(filename, buffer)
    return c.ok({ message: `Downloaded to ${filename}`, size: buffer.length })
  } catch (e: any) {
    return c.error({ code: 'DOWNLOAD_ERROR', message: e.message })
  }
}

export const mediaCmd = Cli.create('media', { description: 'Media operations' })
  .command('get', {
    description: 'Get media metadata by ID',
    args: z.object({ id: z.string() }),
    options: globalOptions,
    run: getHandler
  })
  .command('search', {
    description: 'Search media',
    options: globalOptions.extend({
      query: z.string().optional().describe('Search query text'),
      limit: z.coerce.number().default(20).describe('Max results'),
      offset: z.coerce.number().default(0).describe('Pagination offset'),
    }),
    run: searchHandler
  })
  .command('view', {
    description: 'View an image directly in the terminal (Requires iTerm2/Kitty/WezTerm)',
    args: z.object({ id: z.string() }),
    options: globalOptions.extend({
      width: z.string().default('auto').describe('Width (e.g. 50%, 400px)'),
      height: z.string().default('auto').describe('Height (e.g. auto, 400px)'),
    }),
    run: viewHandler
  })
  .command('download', {
    description: 'Download media file by ID',
    args: z.object({ id: z.string() }),
    options: globalOptions.extend({
      output: z.string().optional().describe('Output file path (optional)'),
    }),
    run: downloadHandler
  })
