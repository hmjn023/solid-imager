import type { TagRepository as TagRepositoryDef } from "@solid-imager/core/domain/repositories/tag-repository";
import { createTagRepository } from "@solid-imager/db/repositories/tag-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { db } from "~/infrastructure/db/index";

export class DrizzleTagRepository implements TagRepositoryDef {
	private readonly repository = createTagRepository(
		(tx) => (tx ?? db) as DrizzleExecutor,
		{
			transaction: (callback) => db.transaction((tx) => callback(tx)),
		},
	);

	findAll: TagRepositoryDef["findAll"] = () => this.repository.findAll();

	findById: TagRepositoryDef["findById"] = (id) => this.repository.findById(id);

	findByName: TagRepositoryDef["findByName"] = (name) =>
		this.repository.findByName(name);

	create: TagRepositoryDef["create"] = (tag, tx) =>
		this.repository.create(tag, tx);

	update: TagRepositoryDef["update"] = (id, tag, tx) =>
		this.repository.update(id, tag, tx);

	delete: TagRepositoryDef["delete"] = (id, tx) =>
		this.repository.delete(id, tx);

	findByMediaId: TagRepositoryDef["findByMediaId"] = (mediaId, tx) =>
		this.repository.findByMediaId(mediaId, tx);

	addTagsToMedia: TagRepositoryDef["addTagsToMedia"] = (
		mediaId,
		tags,
		source,
		tx,
	) => this.repository.addTagsToMedia(mediaId, tags, source, tx);
}

export const TagRepository = new DrizzleTagRepository();
