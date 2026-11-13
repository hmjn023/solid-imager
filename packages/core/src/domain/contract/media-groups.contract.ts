import { openapi } from "@orpc/openapi";
import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	createMediaGroupSchema,
	mediaGroupSchema,
	setGroupMemberSchema,
} from "../media/groups";
export const mediaGroupsContract = {
	list: oc
		.meta(
			openapi({
				tags: ["Media"],
				summary: "画像の関係グループを検索",
				description:
					"mediaIdで所属グループ、queryで名前を検索します。却下済みの所属も編集用に返します。最大100グループ。",
			}),
		)
		.input(
			z.object({
				mediaId: z.uuid().optional(),
				query: z.string().max(200).optional(),
			}),
		)
		.output(z.array(mediaGroupSchema)),
	create: oc
		.meta(openapi({ tags: ["Media"], summary: "画像の関係グループを作成" }))
		.input(createMediaGroupSchema)
		.output(z.object({ id: z.uuid() })),
	setMember: oc
		.meta(
			openapi({
				tags: ["Media"],
				summary: "画像の所属・状態・順番を保存",
				description:
					"rejectedで解除を記録します。自動取り込みは手動の判断を上書きしません。",
			}),
		)
		.input(setGroupMemberSchema)
		.output(z.void()),
};
