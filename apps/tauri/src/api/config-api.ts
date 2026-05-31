import { client } from "~/orpc-client";

export function fetchConfig() {
	return client.config.get();
}
