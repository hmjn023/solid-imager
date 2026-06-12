import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { createQuery } from "@tanstack/solid-query";
import { createMemo } from "solid-js";

export type SourceRootPathResolver = (
	mediaSourceId: string,
) => string | undefined;

export function useSourceRootPath(
	sourcesQueryOptions: () => unknown,
): SourceRootPathResolver {
	const sources = createQuery(() => sourcesQueryOptions() as any);

	return (mediaSourceId: string) => {
		const list = sources.data as SafeMediaSource[] | undefined;
		const current = list?.find((item) => item.id === mediaSourceId);
		if (current?.type !== "local") {
			return undefined;
		}
		const connectionInfo = current.connectionInfo as { path?: string };
		return connectionInfo.path;
	};
}

export function createStaticSourceRootPath(
	path: string | undefined,
): SourceRootPathResolver {
	return () => path;
}
