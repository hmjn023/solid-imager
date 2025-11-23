/**
 * IPs API Client
 */

import { z } from "zod";
import { ipSchema } from "~/domain/ips/schemas";
import { apiRequest } from "./shared/base-client";
import { API_ENDPOINTS } from "./shared/endpoints";

const ipListSchema = z.array(ipSchema);

export function fetchAllIps() {
  return apiRequest(API_ENDPOINTS.ips, ipListSchema);
}

export function createIp(data: { name: string; description?: string }) {
  return apiRequest(API_ENDPOINTS.ips, ipSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function updateIp(
  id: number,
  data: { name?: string; description?: string }
) {
  return apiRequest(`${API_ENDPOINTS.ips}/${id}`, ipSchema, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function deleteIp(id: number) {
  return apiRequest(`${API_ENDPOINTS.ips}/${id}`, ipSchema, {
    method: "DELETE",
  });
}

export function fetchIpsForMedia(sourceId: string, mediaId: string) {
  return apiRequest(API_ENDPOINTS.mediaIps(sourceId, mediaId), ipListSchema);
}

export function addIpToMedia(sourceId: string, mediaId: string, ipId: number) {
  return apiRequest(API_ENDPOINTS.mediaIps(sourceId, mediaId), z.any(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ipId }),
  });
}

export function removeIpFromMedia(
  sourceId: string,
  mediaId: string,
  ipId: number
) {
  return apiRequest(API_ENDPOINTS.mediaIps(sourceId, mediaId), z.any(), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ipId }),
  });
}
