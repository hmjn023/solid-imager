/**
 * Fetch URL API Client
 * Handles fetching files from external URLs
 */

import { apiBlobRequest } from "./shared/base-client";
import { API_ENDPOINTS } from "./shared/endpoints";

/**
 * Fetches a file from an external URL via the backend proxy
 * @param url - The external URL to fetch from
 * @returns Blob containing the fetched file
 */
export function fetchFromUrl(url: string): Promise<Blob> {
  return apiBlobRequest(API_ENDPOINTS.fetchUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}
