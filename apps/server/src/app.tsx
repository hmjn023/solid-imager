import { Toaster } from "@solid-imager/ui/toast";
import { Meta, MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { ErrorBoundary, Suspense } from "solid-js";
import Nav from "./components/nav";
import "./app.css";
import { TanStackDbProvider } from "./application/db/provider";

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MINUTES_TO_MS = SECONDS_PER_MINUTE * MS_PER_SECOND;
const FIVE_MINUTES = 5;
const FIVE_MINUTES_IN_MS = FIVE_MINUTES * MINUTES_TO_MS;

/**
 * Initializes a new TanStack Query client with default options.
 * Configures queries to retry once, have a stale time of 5 minutes, and not refetch on window focus.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: FIVE_MINUTES_IN_MS,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * The main application component.
 * Sets up MetaProvider for SEO, QueryClientProvider for data fetching, and Solid Router for navigation.
 * @returns {JSX.Element} The root of the Solid Imager application.
 */
export default function App() {
  return (
    <MetaProvider>
      <Title>Solid Imager</Title>
      <Meta charset="utf-8" />
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary
          fallback={(err) => <div>Error rendering app: {err.message}</div>}
        >
          <TanStackDbProvider>
            <Router
              root={(props) => (
                <>
                  <Nav />
                  <Toaster />
                  <Suspense fallback={<div>Loading...</div>}>
                    {props.children}
                  </Suspense>
                </>
              )}
            >
              <FileRoutes />
            </Router>
          </TanStackDbProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </MetaProvider>
  );
}
