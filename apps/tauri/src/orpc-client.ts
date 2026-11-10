import { createClient, type ClientOptions } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/contract";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import {
	getApiBaseUrl,
	isDevelopmentProxy,
	setApiBaseUrl,
} from "~/infrastructure/api-base";

export const fetchServer: NonNullable<ClientOptions["fetch"]> = (url, init) =>
	isDevelopmentProxy()
		? fetch(url, init)
		: tauriFetch(
				url,
				init?.redirect === "error" ? { ...init, maxRedirections: 0 } : init,
			);

export const client = createClient<AppContract>({
	url: getApiBaseUrl,
	fetch: fetchServer,
});
export const orpc = client;

export function configureApiBaseUrl(baseUrl: string): void {
	setApiBaseUrl(baseUrl);
}
