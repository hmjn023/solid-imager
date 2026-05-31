import { createClient } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/domain/contract";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

const isDev = import.meta.env.DEV;
const SERVER_URL = isDev
	? window.location.origin
	: import.meta.env.VITE_API_URL || "http://192.168.1.150:3000";

const tauriFetchAdapter = (
	request: Request,
	init?: RequestInit & { redirect?: Request["redirect"] },
): Promise<Response> => {
	return tauriFetch(request, init);
};

export const serverOrpc = createClient<AppContract>({
	url: SERVER_URL,
	fetch: isDev ? undefined : tauriFetchAdapter,
});
