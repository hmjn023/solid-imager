import type { AppContractClient } from "@solid-imager/core/contract";
import type { MediaGroup } from "@solid-imager/core/media";
import { MediaGroups } from "@solid-imager/ui/media-groups";

export function MediaGroupsGallery() {
	const mediaId = "00000000-0000-4000-8000-000000000001";
	const sourceId = "00000000-0000-4000-8000-000000000010";
	const groups: MediaGroup[] = [
		{
			id: "00000000-0000-4000-8000-000000000020",
			title: "pixiv:42",
			kind: "post",
			sourceKey: "pixiv:42",
			members: [1, 2].map((n) => ({
				mediaId: `00000000-0000-4000-8000-00000000000${n}`,
				mediaSourceId: sourceId,
				fileName: `page-${n}.png`,
				position: n - 1,
				state: "confirmed",
				origin: "source",
			})),
		},
	];
	const client: AppContractClient["mediaGroups"] = {
		list: async ({ mediaId: selected, query }) =>
			structuredClone(
				groups.filter(
					(g) =>
						(!selected || g.members.some((m) => m.mediaId === selected)) &&
						(!query || g.title.includes(query)),
				),
			),
		create: async (input) => {
			if (input.title === "fail") throw new Error("Fixture save failed");
			const id = crypto.randomUUID();
			groups.push({
				id,
				title: input.title,
				kind: input.kind,
				sourceKey: null,
				members: input.mediaIds.map((id, position) => ({
					mediaId: id,
					mediaSourceId: sourceId,
					fileName: `page-${id.endsWith("1") ? 1 : 2}.png`,
					position,
					state: input.state ?? "tentative",
					origin: "manual",
				})),
			});
			return { id };
		},
		setMember: async (input) => {
			const group = groups.find((g) => g.id === input.groupId);
			const member = group?.members.find((m) => m.mediaId === input.mediaId);
			if (!member) throw new Error("Missing fixture member");
			Object.assign(member, {
				state: input.state,
				position: input.position,
				origin: "manual",
			});
		},
	};
	return (
		<main class="mx-auto max-w-3xl p-4">
			<MediaGroups mediaId={mediaId} client={client} />
		</main>
	);
}
