/**
 * Fetch URL API Client
 *
 * NOTE: Migrated to use oRPC ✅
 */

import { orpc } from "~/infrastructure/api-clients/orpc-client";

/**
 * Fetches a file from an external URL via the backend proxy
 * @param url - The external URL to fetch from
 * @returns Blob containing the fetched file
 */
export function fetchFromUrl(url: string): Promise<Blob> {
	return orpc.utils.fetchUrl({ url });
}
