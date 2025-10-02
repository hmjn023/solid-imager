import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/solid-query";
import { ErrorBoundary, Suspense } from "solid-js";

function App() {
  const repositoryQuery = useQuery(() => ({
    queryKey: ["TanStack Query"],
    queryFn: async () => {
      const result = await fetch("https://api.github.com/repos/TanStack/query");
      if (!result.ok) {
        throw new Error("Failed to fetch data");
      }
      return result.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    throwOnError: true, // Throw an error if the query fails
  }));

  return (
    <div>
      <div>Static Content</div>
      {/* An error while fetching will be caught by the ErrorBoundary */}
      <ErrorBoundary fallback={<div>Something went wrong!</div>}>
        {/* Suspense will trigger a loading state while the data is being fetched */}
        <Suspense fallback={<div>Loading...</div>}>
          {/* 
            The `data` property on a query is a SolidJS resource  
            so it will work with Suspense and transitions out of the box! 
          */}
          <div>{repositoryQuery.data?.updated_at}</div>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

const root = document.getElementById("root");
const client = new QueryClient();

render(
  () => (
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  ),
  root!
);
