import type { RouterClient } from "@orpc/server";
import { createIsomorphicFn } from "@tanstack/solid-start";
import type { AppRouter } from "~/domain/shared/api-contract";
import { runtimeCapabilities } from "./runtime-capabilities";
import { serverAppClient } from "./server-app-client.server";
import { tauriAppClient } from "./tauri-app-client";
import { webAppClient } from "./web-app-client";

const getAppClient = createIsomorphicFn()
	.server(() => serverAppClient)
	.client((): RouterClient<AppRouter> => {
		if (__TAURI_BUILD__) {
			return tauriAppClient;
		}

		return webAppClient;
	});

export const appClient: RouterClient<AppRouter> =
	getAppClient() as RouterClient<AppRouter>;

export { runtimeCapabilities };
