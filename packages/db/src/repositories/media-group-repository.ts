import { and, asc, eq, ilike, inArray, isNull } from "drizzle-orm";
import type {
	CreateMediaGroup,
	MediaGroup,
	SetGroupMember,
	SourcePost,
} from "@solid-imager/core/media";
import { mediaGroups, mediaGroupMembers, medias } from "../schema";
import type { DrizzleExecutor } from "../types";

export function createMediaGroupRepository(
	getExecutor: (tx?: unknown) => DrizzleExecutor,
) {
	return {
		async list(input: {
			mediaId?: string;
			query?: string;
		}): Promise<MediaGroup[]> {
			const db = getExecutor();
			const ids = input.mediaId
				? await db
						.select({ id: mediaGroupMembers.groupId })
						.from(mediaGroupMembers)
						.where(eq(mediaGroupMembers.mediaId, input.mediaId))
				: undefined;
			if (ids?.length === 0) return [];
			const groups = await db
				.select()
				.from(mediaGroups)
				.where(
					and(
						ids
							? inArray(
									mediaGroups.id,
									ids.map((g) => g.id),
								)
							: undefined,
						input.query
							? ilike(
									mediaGroups.title,
									`%${input.query.replace(/[\\%_]/g, "\\$&")}%`,
								)
							: undefined,
					),
				)
				.orderBy(asc(mediaGroups.title), asc(mediaGroups.id))
				.limit(100);
			if (!groups.length) return [];
			const members = await db
				.select({
					groupId: mediaGroupMembers.groupId,
					mediaId: medias.id,
					fileName: medias.fileName,
					mediaSourceId: medias.mediaSourceId,
					position: mediaGroupMembers.position,
					state: mediaGroupMembers.state,
					origin: mediaGroupMembers.origin,
				})
				.from(mediaGroupMembers)
				.innerJoin(medias, eq(medias.id, mediaGroupMembers.mediaId))
				.where(
					inArray(
						mediaGroupMembers.groupId,
						groups.map((g) => g.id),
					),
				)
				.orderBy(asc(mediaGroupMembers.position), asc(medias.id));
			return groups.map((g) => ({
				...g,
				members: members
					.filter((m) => m.groupId === g.id)
					.map(({ groupId: _groupId, ...m }) => m),
			}));
		},
		async create(input: CreateMediaGroup) {
			return getExecutor().transaction(async (tx) => {
				const [group] = await tx
					.insert(mediaGroups)
					.values({ title: input.title, kind: input.kind })
					.returning();
				await tx.insert(mediaGroupMembers).values(
					input.mediaIds.map((mediaId, position) => ({
						groupId: group.id,
						mediaId,
						position,
						state: input.state,
						origin: "manual" as const,
					})),
				);
				return { id: group.id };
			});
		},
		async setMember(input: SetGroupMember) {
			await getExecutor()
				.insert(mediaGroupMembers)
				.values({ ...input, origin: "manual" })
				.onConflictDoUpdate({
					target: [mediaGroupMembers.groupId, mediaGroupMembers.mediaId],
					set: {
						state: input.state,
						position: input.position,
						origin: "manual",
					},
				});
		},
		/** Upsert identity, but never overwrite a user's decision or ordering on reimport. */
		async observe(mediaId: string, post: SourcePost, transaction?: unknown) {
			const db = getExecutor(transaction);
			const key = `${post.platform}:${post.postId}`;
			await db
				.insert(mediaGroups)
				.values({ title: key, kind: "post", sourceKey: key })
				.onConflictDoNothing({ target: mediaGroups.sourceKey });
			const [group] = await db
				.select()
				.from(mediaGroups)
				.where(eq(mediaGroups.sourceKey, key));
			await db
				.insert(mediaGroupMembers)
				.values({
					groupId: group.id,
					mediaId,
					position: post.position,
					state: "confirmed",
					origin: "source",
				})
				.onConflictDoUpdate({
					target: [mediaGroupMembers.groupId, mediaGroupMembers.mediaId],
					set: { position: post.position },
					setWhere: and(
						eq(mediaGroupMembers.origin, "source"),
						isNull(mediaGroupMembers.position),
					),
				});
		},
	};
}
