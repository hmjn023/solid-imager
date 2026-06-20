import { oc } from "@orpc/contract";
import { z } from "zod";

export const thumbnailsContract = {
	generate: oc.input(z.object({ sourceId: z.string().uuid() })),

	clear: oc.input(z.object({ sourceId: z.string().uuid() })),
};
