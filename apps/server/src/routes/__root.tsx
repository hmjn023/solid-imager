import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/solid-router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import { HydrationScript } from 'solid-js/web'
import { Suspense } from 'solid-js'
import { QueryClientProvider, type QueryClient } from '@tanstack/solid-query'
import { Toaster } from "@solid-imager/ui/toast"
import Nav from '~/components/nav'
import '~/app.css'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Solid Imager' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico' }
    ]
  }),
  component: RootComponent,
})

function RootComponent() {
  const context = Route.useRouteContext()
  return (
    <html lang="en">
      <head>
        <HydrationScript />
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={context().queryClient}>
          <Nav />
          <Toaster />
          <Suspense>
            <Outlet />
            <TanStackRouterDevtools />
          </Suspense>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
