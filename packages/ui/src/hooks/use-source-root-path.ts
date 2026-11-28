import type { SafeMediaSource } from "@solid-imager/core/sources";
import { useQuery } from "@tanstack/solid-query";

export type SourceRootPathResolver = (
	mediaSourceId: string,
) => string | undefined;

/** Resolves local source IDs to root paths from the sources query; remote or unknown sources return undefined. */
export function useSourceRootPath(
	// oxlint-disable-next-line typescript/no-explicit-any -- library type mismatch between oRPC and solid-query
	sourcesQueryOptions: () => any,
): SourceRootPathResolver {
	const sources = useQuery<SafeMediaSource[]>(sourcesQueryOptions);

	return (mediaSourceId: string) => {
		const list = readQueryData(sources);
		const current = list?.find((item) => item.id === mediaSourceId);
		if (current?.type !== "local") {
			return undefined;
		}
		const connectionInfo = current.connectionInfo as
			| { path?: string }
			| undefined
			| null;
		return connectionInfo?.path;
	};
}

export function createStaticSourceRootPath(
	path: string | undefined,
): SourceRootPathResolver {
	return () => path;
}

import { readQueryData } from "../query-state";
