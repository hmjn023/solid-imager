import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/errors";
import type { UpdatePositiveMediaTags } from "@solid-imager/core/media";
import { canonicalTagName } from "@solid-imager/core/tags";
import { and, eq, inArray } from "drizzle-orm";
import { medias, mediaTags, tagDictionaryTags, tags } from "../schema";
import type { DrizzleExecutor } from "../types";
import { lockTagNames, resolveTagNameRedirects } from "./tag-migration";

export async function writePositiveMediaTags(
	db: DrizzleExecutor,
	input: UpdatePositiveMediaTags,
) {
	// Name resolution and assignment changes must both precede a migration.
	await lockTagNames(db, false);
	const [media] = await db
		.select({ id: medias.id })
		.from(medias)
		.where(
			and(
				eq(medias.id, input.mediaId),
				eq(medias.mediaSourceId, input.mediaSourceId),
			),
		)
		.for("update");
	if (!media) throw new ResourceNotFoundError("Media", input.mediaId);

	const positive = and(
		eq(mediaTags.mediaId, media.id),
		eq(mediaTags.tagType, "positive"),
	);
	const current = await db
		.select({ id: tags.id, name: tags.name })
		.from(mediaTags)
		.innerJoin(tags, eq(tags.id, mediaTags.tagId))
		.where(positive);
	const expected = new Map(input.expected.map(({ id, name }) => [id, name]));
	if (
		current.length !== expected.size ||
		current.some(({ id, name }) => expected.get(id) !== name)
	) {
		throw new ResourceConflictError(
			"Tags changed since editing began. Reload the tags and try again.",
		);
	}
	const names = await resolveTagNames(db, input.entries);
	const removed = current
		.filter(({ name }) => !names.has(name))
		.map(({ id }) => id);
	const currentNames = new Set(current.map(({ name }) => name));
	const added = [...names].filter((name) => !currentNames.has(name)).sort();
	if (removed.length > 0) {
		await db
			.delete(mediaTags)
			.where(and(positive, inArray(mediaTags.tagId, removed)));
	}
	if (added.length > 0) {
		await db
			.insert(tags)
			.values(added.map((name) => ({ name })))
			.onConflictDoNothing({ target: tags.name });
		const assignments = await db
			.select({ id: tags.id })
			.from(tags)
			.where(inArray(tags.name, added))
			.orderBy(tags.id)
			.for("key share");
		if (assignments.length !== added.length) {
			throw new ResourceConflictError(
				"One or more tags changed. Reload the tags and try again.",
			);
		}
		await db
			.insert(mediaTags)
			.values(
				assignments.map(({ id }) => ({
					mediaId: media.id,
					tagId: id,
					tagType: "positive" as const,
					confidence: 1,
				})),
			)
			.onConflictDoNothing();
	}
}

async function resolveTagNames(
	db: DrizzleExecutor,
	entries: UpdatePositiveMediaTags["entries"],
) {
	if (entries.length === 0) return new Set<string>();
	const requested = [...new Set(entries.map(({ name }) => name))];
	const selected = new Set(
		entries
			.filter(({ fromDictionary }) => fromDictionary)
			.map(({ name }) => name),
	);
	const redirects = await resolveTagNameRedirects(db, requested);
	const exactRows = await db
		.select({ name: tags.name })
		.from(tags)
		.where(inArray(tags.name, requested));
	const exact = new Set(exactRows.map(({ name }) => name));
	const equivalents = new Map<string, string | null>();
	if (selected.size > 0) {
		const dictionary = await db
			.select({ name: tagDictionaryTags.name })
			.from(tagDictionaryTags)
			.where(inArray(tagDictionaryTags.name, [...selected]));
		if (dictionary.length !== selected.size) {
			throw new ResourceConflictError(
				"The dictionary changed. Choose the tag again.",
			);
		}
		const unmatched = new Set(
			[...selected].filter((name) => !exact.has(name) && !redirects.has(name)),
		);
		if (unmatched.size > 0) {
			for (const { name } of await db.select({ name: tags.name }).from(tags)) {
				const canonical = canonicalTagName(name);
				if (unmatched.has(canonical)) {
					equivalents.set(canonical, equivalents.has(canonical) ? null : name);
				}
			}
		}
	}
	return new Set(
		requested.map(
			(name) => redirects.get(name)?.name ?? equivalents.get(name) ?? name,
		),
	);
}
