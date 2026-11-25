import { createClient } from "@solid-imager/client";
import { appContract } from "@solid-imager/core/contract";
import { getServerBaseUrl } from "./utils";

/** Creates a client for the supplied host, defaulting to localhost and adding HTTP when omitted. */
export function getClient(url: string) {
	return createClient(appContract, { url: getServerBaseUrl(url) });
}
