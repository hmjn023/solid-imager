/**
 * Projects API Client
 *
 * NOTE: Migrated to use oRPC ✅
 */

import { orpc } from "~/infrastructure/api-clients/orpc-client";

export function fetchAllProjects() {
  return orpc.projects.list();
}

export function createProject(data: { name: string; description?: string }) {
  return orpc.projects.create(data);
}

export function updateProject(
  id: string,
  data: { name?: string; description?: string }
) {
  return orpc.projects.update({ id, data });
}

export function deleteProject(id: string) {
  return orpc.projects.delete({ id });
}

export function fetchProjectsForMedia(_sourceId: string, mediaId: string) {
  return orpc.projects.listForMedia({ mediaId });
}

export function addProjectToMedia(
  _sourceId: string,
  mediaId: string,
  projectId: string
) {
  return orpc.projects.addToMedia({ mediaId, projectId });
}

export function removeProjectFromMedia(
  _sourceId: string,
  mediaId: string,
  projectId: string
) {
  return orpc.projects.removeFromMedia({ mediaId, projectId });
}
