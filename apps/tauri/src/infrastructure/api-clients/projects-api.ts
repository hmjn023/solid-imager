export { fetchAllProjects } from "~/api/entities-api";

import {
	defaultProjectsQueryConfig,
	projectsQueryKeys,
} from "@solid-imager/ui/query-options";
import { client } from "~/orpc-client";

export function createProject(data: { name: string; description?: string }) {
	return client.projects.create(data);
}

export function updateProject(
	id: string,
	data: { name?: string; description?: string },
) {
	return client.projects.update({ id, data });
}

export async function deleteProject(id: string) {
	await client.projects.delete({ id });
}

export async function addProjectToMedia(mediaId: string, projectId: string) {
	await client.projects.addToMedia({ mediaId, projectId });
}

export async function removeProjectFromMedia(
	mediaId: string,
	projectId: string,
) {
	await client.projects.removeFromMedia({ mediaId, projectId });
}

export function projectsForMediaQueryOptions(mediaId: string) {
	return {
		queryKey: projectsQueryKeys.forMedia(mediaId),
		queryFn: ({ signal }: { signal: AbortSignal }) =>
			client.projects.listForMedia({ mediaId }, { signal }),
		...defaultProjectsQueryConfig,
	};
}
