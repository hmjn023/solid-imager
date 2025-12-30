/**
 * Projects API Client
 */

import { z } from "zod";
import { projectSchema } from "~/domain/projects/schemas";
import { apiRequest } from "./shared/base-client";
import { API_ENDPOINTS } from "./shared/endpoints";

const projectListSchema = z.array(projectSchema);

export function fetchAllProjects() {
  return apiRequest(API_ENDPOINTS.projects, projectListSchema);
}

export function createProject(data: { name: string; description?: string }) {
  return apiRequest(API_ENDPOINTS.projects, projectSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function updateProject(
  id: string,
  data: { name?: string; description?: string }
) {
  return apiRequest(`${API_ENDPOINTS.projects}/${id}`, projectSchema, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function deleteProject(id: string) {
  return apiRequest(`${API_ENDPOINTS.projects}/${id}`, projectSchema, {
    method: "DELETE",
  });
}

export function fetchProjectsForMedia(sourceId: string, mediaId: string) {
  return apiRequest(
    API_ENDPOINTS.mediaProjects(sourceId, mediaId),
    projectListSchema
  );
}

export function addProjectToMedia(
  sourceId: string,
  mediaId: string,
  projectId: string
) {
  return apiRequest(API_ENDPOINTS.mediaProjects(sourceId, mediaId), z.any(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
}

export function removeProjectFromMedia(
  sourceId: string,
  mediaId: string,
  projectId: string
) {
  return apiRequest(API_ENDPOINTS.mediaProjects(sourceId, mediaId), z.any(), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
}
