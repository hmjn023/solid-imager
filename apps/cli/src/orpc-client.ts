import { createClient } from "@solid-imager/client";

export function getClient(url: string) {
	const remoteUrl = url || "http://localhost:3000";
	let base = remoteUrl;
	if (!/^https?:\/\//.test(base)) {
		base = `http://${base}`;
	}
	return createClient({ url: base });
}
