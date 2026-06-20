import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { createQuery } from "@tanstack/solid-query";

export type SourceRootPathResolver = (
	mediaSourceId: string,
) => string | undefined;

export function useSourceRootPath(
	// biome-ignore lint/suspicious/noExplicitAny: library type mismatch between oRPC and solid-query
	sourcesQueryOptions: () => any,
): SourceRootPathResolver {
	const sources = createQuery<SafeMediaSource[]>(sourcesQueryOptions);

	return (mediaSourceId: string) => {
		const list = sources.data;
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
