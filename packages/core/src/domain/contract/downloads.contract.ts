import { oc } from "@orpc/contract";
import { z } from "zod";
import { bulkDownloadRequestSchema } from "../media/schemas";

export const downloadsContract = {
	start: oc
		.input(bulkDownloadRequestSchema)
		.output(
			z.object({
				success: z.boolean(),
				jobCount: z.number(),
				message: z.string(),
			}),
		),
};
