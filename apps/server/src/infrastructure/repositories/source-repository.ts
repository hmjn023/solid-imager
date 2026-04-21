import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import { createSourceRepository } from "@solid-imager/db/repositories/source-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { db } from "~/infrastructure/db/index";

export class DrizzleSourceRepository implements SourceRepository {
	private readonly repository = createSourceRepository(
		(tx) => (tx ?? db) as DrizzleExecutor,
	);

	findAll: SourceRepository["findAll"] = () => this.repository.findAll();

	findById: SourceRepository["findById"] = (id, tx) =>
		this.repository.findById(id, tx);

	create: SourceRepository["create"] = (source, tx) =>
		this.repository.create(source, tx);

	update: SourceRepository["update"] = (id, source, tx) =>
		this.repository.update(id, source, tx);

	delete: SourceRepository["delete"] = (id, tx) =>
		this.repository.delete(id, tx);
}
