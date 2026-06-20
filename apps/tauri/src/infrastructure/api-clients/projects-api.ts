export { fetchAllProjects } from "~/api/entities-api";

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
		queryKey: ["projectsForMedia", mediaId],
		queryFn: () => client.projects.listForMedia({ mediaId }),
	};
}
