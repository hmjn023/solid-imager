import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";

export const healthContract = oc
	.meta(
		openapi({ method: "GET", path: "/health", summary: "サーバーの死活確認" }),
	)
	.output(
		z.object({ service: z.literal("solid-imager"), status: z.literal("ok") }),
	);
