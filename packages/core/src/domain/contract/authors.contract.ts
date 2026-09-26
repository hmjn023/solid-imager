import { oc } from "@orpc/contract";
import { authorSchema } from "../authors/schemas";

export const authorsContract = {
	list: oc
		.route({
			tags: ["Authors"],
			summary: "作者一覧取得",
			description: "登録済みの作者を一覧で取得します。",
		})
		.output(authorSchema.array()),
};
