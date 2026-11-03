import { openapi } from "@orpc/openapi";
import { oc } from "@orpc/contract";
import { z } from "zod";

export const utilsContract = {
	fetchUrl: oc
		.meta(
			openapi({
				tags: ["Utilities"],
				summary: "URLの内容取得",
				description: "指定URLの内容をサーバーから取得し、Blobとして返します。",
			}),
		)
		.input(z.object({ url: z.url() }))
		.output(
			z
				.instanceof(Blob)
				.meta({ type: "string", format: "binary", contentMediaType: "*/*" }),
		),
};
