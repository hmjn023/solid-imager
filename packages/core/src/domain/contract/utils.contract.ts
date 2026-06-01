import { oc } from "@orpc/contract";
import { z } from "zod";

export const utilsContract = {
	fetchUrl: oc
		.input(z.object({ url: z.string().url() })),
};
