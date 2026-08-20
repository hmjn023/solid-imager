import type { ISearchSnapshotService } from "@solid-imager/application";
import { createSearchSnapshotService } from "@solid-imager/application/services/search-snapshot-service";
import type { SearchSnapshotRepository as SearchSnapshotRepositoryPort } from "@solid-imager/core/domain/repositories/search-snapshot-repository";
import { SearchSnapshotRepository } from "~/infrastructure/repositories/search-snapshot-repository";

let service: ISearchSnapshotService = createSearchSnapshotService(
	SearchSnapshotRepository,
);

export const setSearchSnapshotRepository = (
	repository: SearchSnapshotRepositoryPort,
) => {
	service = createSearchSnapshotService(repository);
};

export const SearchSnapshotService = new Proxy({} as ISearchSnapshotService, {
	get(_, property) {
		const value = service[property as keyof ISearchSnapshotService];
		return typeof value === "function" ? value.bind(service) : value;
	},
});
