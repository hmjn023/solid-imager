import { createORPCClient } from '@orpc/client'
import { RPCLink } from "@orpc/client/fetch"
import type { AppRouter } from '@solid-imager/server/src/domain/shared/api-contract'

export function getClient(url: string) {
  const fetchLink = new RPCLink({
    url: new URL('/api/rpc', url || 'http://localhost:3000').toString(),
    fetch: fetch,
  })
  return createORPCClient<AppRouter>(fetchLink)
}
