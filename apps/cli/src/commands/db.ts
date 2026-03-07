import { Cli, z } from 'incur'
import { spawn } from 'node:child_process'
import { createWriteStream, createReadStream } from 'node:fs'

function runSpawn(command: string, args: string[], options: {
  stdio?: any
} = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options)

    let stderr = ''
    if (child.stderr) {
       child.stderr.on('data', data => stderr += data.toString())
    }

    child.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed with code ${code}:\n${stderr}`))
    })
    child.on('error', reject)
  })
}

export const dbCmd = Cli.create('db', { description: 'Database operations (Local server only)' })
  .command('dump', {
    description: 'Dump the local database',
    options: z.object({
      format: z.enum(['sql', 'json', 'zip']).default('sql').describe('Dump format'),
      output: z.string().default('./dump.sql').describe('Output file path'),
      docker: z.boolean().default(true).describe('Use docker exec to dump from running container'),
    }),
    async run(c) {
      if (c.options.format !== 'sql') {
        return c.error({ code: 'NOT_IMPLEMENTED', message: `Format ${c.options.format} dump is not yet implemented natively in CLI.` })
      }

      try {
         const outStream = createWriteStream(c.options.output)
         const writePromise = new Promise((resolve, reject) => {
           outStream.on('finish', resolve)
           outStream.on('error', reject)
         })

         if (c.options.docker) {
           if (!c.agent) process.stdout.write(`Executing docker dump...\n`)
           // No -t (tty) flag to prevent \r\n corruption and non-interactive errors
           const child = spawn('docker', ['exec', '-i', 'solid-imager-db-1', 'pg_dump', '-U', 'postgres', 'solid_imager'], {
             stdio: ['ignore', 'pipe', 'pipe']
           })
           child.stdout.pipe(outStream)

           let stderr = ''
           child.stderr.on('data', data => stderr += data.toString())

           const exitCode = await new Promise<number>((resolve, reject) => {
             child.on('close', resolve)
             child.on('error', reject)
           })

           if (exitCode !== 0) {
              throw new Error(`pg_dump failed (code ${exitCode}): ${stderr}`)
           }
         } else {
           if (!c.agent) process.stdout.write(`Executing local pg_dump...\n`)
           const child = spawn('pg_dump', ['-U', 'postgres', '-d', 'solid_imager'], {
             stdio: ['ignore', 'pipe', 'pipe']
           })
           child.stdout.pipe(outStream)

           let stderr = ''
           child.stderr.on('data', data => stderr += data.toString())

           const exitCode = await new Promise<number>((resolve, reject) => {
             child.on('close', resolve)
             child.on('error', reject)
           })

           if (exitCode !== 0) {
             throw new Error(`pg_dump failed (code ${exitCode}): ${stderr}`)
           }
         }

         await writePromise
         return c.ok({ success: true, file: c.options.output, format: c.options.format })
      } catch (e: any) {
         return c.error({ code: 'DUMP_ERROR', message: e.message })
      }
    }
  })
  .command('restore', {
    description: 'Restore the local database',
    args: z.object({ filepath: z.string() }),
    options: z.object({
      docker: z.boolean().default(true).describe('Use docker exec to restore to running container'),
    }),
    async run(c) {
      try {
         const inStream = createReadStream(c.args.filepath)

         if (c.options.docker) {
           if (!c.agent) process.stdout.write(`Executing docker restore...\n`)
           const child = spawn('docker', ['exec', '-i', 'solid-imager-db-1', 'psql', '-U', 'postgres', '-d', 'solid_imager'], {
             stdio: ['pipe', 'pipe', 'pipe']
           })
           inStream.pipe(child.stdin).on('error', (err) => {
             child.kill()
             throw err
           })

           let stderr = ''
           child.stderr.on('data', data => stderr += data.toString())

           await new Promise<void>((resolve, reject) => {
             child.on('close', code => {
               if (code === 0) resolve()
               else reject(new Error(`psql failed (code ${code}): ${stderr}`))
             })
             child.on('error', reject)
           })
         } else {
           if (!c.agent) process.stdout.write(`Executing local psql restore...\n`)
           const child = spawn('psql', ['-U', 'postgres', '-d', 'solid_imager'], {
             stdio: ['pipe', 'pipe', 'pipe']
           })
           inStream.pipe(child.stdin).on('error', (err) => {
             child.kill()
             throw err
           })

           let stderr = ''
           child.stderr.on('data', data => stderr += data.toString())

           await new Promise<void>((resolve, reject) => {
             child.on('close', code => {
               if (code === 0) resolve()
               else reject(new Error(`psql failed (code ${code}): ${stderr}`))
             })
             child.on('error', reject)
           })
         }
         return c.ok({ success: true, file: c.args.filepath })
      } catch (e: any) {
         return c.error({ code: 'RESTORE_ERROR', message: e.message })
      }
    }
  })
