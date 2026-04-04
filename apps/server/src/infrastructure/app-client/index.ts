import type { RouterClient } from "@orpc/server";
import { createIsomorphicFn } from "@tanstack/solid-start";
import type { AppRouter } from "~/domain/shared/api-contract";
import { runtimeCapabilities } from "./runtime-capabilities";
import { serverAppClient } from "./server-app-client.server";
import { tauriAppClient } from "./tauri-app-client";
import { webAppClient } from "./web-app-client";

const isTauriBuild = typeof __TAURI_BUILD__ !== "undefined" && __TAURI_BUILD__;

const getAppClient = createIsomorphicFn()
	.server(() => serverAppClient)
	.client((): RouterClient<AppRouter> => {
		if (isTauriBuild) {
			return tauriAppClient;
		}

		return webAppClient;
	});

export const appClient: RouterClient<AppRouter> =
	getAppClient() as RouterClient<AppRouter>;

export { runtimeCapabilities };
