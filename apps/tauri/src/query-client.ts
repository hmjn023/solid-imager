import { isTransientApiError } from "@solid-imager/client";
import { createAppQueryClientConfig } from "@solid-imager/ui/query-options";
import { QueryClient } from "@tanstack/solid-query";

/**
 * The single query cache shared by the router, route loaders, and Tauri DB
 * collections. Keeping it outside router.tsx avoids importing the generated
 * route tree while collections are being initialized during bootstrap.
 */
export const queryClient = new QueryClient(
	createAppQueryClientConfig(isTransientApiError),
);
