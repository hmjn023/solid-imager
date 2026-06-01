export { allProjectsQueryOptions } from "~/queries/entities-query";

import { client } from "~/orpc-client";

export function projectsForMediaQueryOptions(mediaId: string) {
	return {
		queryKey: ["projectsForMedia", mediaId],
		queryFn: () => client.projects.listForMedia({ mediaId }),
	};
}
