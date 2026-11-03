import { createClient } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/domain/contract";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import {
	getApiBaseUrl,
	isDevelopmentProxy,
	setApiBaseUrl,
} from "~/infrastructure/api-base";

export const client = createClient<AppContract>({
	url: getApiBaseUrl,
	fetch: (url, init) =>
		isDevelopmentProxy() ? fetch(url, init) : tauriFetch(url, init),
});
export const orpc = client;

export function configureApiBaseUrl(baseUrl: string): void {
	setApiBaseUrl(baseUrl);
}
