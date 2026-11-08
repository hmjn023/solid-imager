import {
	type ISearchSnapshotService,
	createSearchSnapshotService,
} from "@solid-imager/application/search";
import type { SearchSnapshotRepository as SearchSnapshotRepositoryPort } from "@solid-imager/core/search";
import { SearchSnapshotRepository } from "~/infrastructure/db/repositories";

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
