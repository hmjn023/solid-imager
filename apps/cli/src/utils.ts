import { z } from 'incur'

/**
 * Safely extract error message from unknown error object
 */
export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

/**
 * Shared global options for commands
 */
export const globalOptions = z.object({
  remote: z.string().default('http://localhost:3000').describe('Remote server URL'),
})
