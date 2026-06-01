import { oc } from "@orpc/contract";
import { AppConfigSchema } from "../config/config-schema";

export const configContract = {
	get: oc
		.output(AppConfigSchema),

	update: oc
		.input(AppConfigSchema.partial())
		.output(AppConfigSchema),
};
