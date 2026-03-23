import { createRouter as createTanStackRouter } from '@tanstack/solid-router'
import { routeTree } from './routeTree.gen'
import { QueryClient } from '@tanstack/solid-query'

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MINUTES_TO_MS = SECONDS_PER_MINUTE * MS_PER_SECOND;
const FIVE_MINUTES = 5;
const FIVE_MINUTES_IN_MS = FIVE_MINUTES * MINUTES_TO_MS;

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: FIVE_MINUTES_IN_MS,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createTanStackRouter({
    routeTree,
    context: {
      queryClient
    },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  return router
}

declare module '@tanstack/solid-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
