import { createClient } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/contract";

/** Creates a client for the supplied host, defaulting to localhost and adding HTTP when omitted. */
export function getClient(url: string) {
	const remoteUrl = url || "http://localhost:3000";
	let base = remoteUrl;
	if (!/^https?:\/\//.test(base)) {
		base = `http://${base}`;
	}
	return createClient<AppContract>({ url: base });
}
