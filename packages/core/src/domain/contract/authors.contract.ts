import { oc } from "@orpc/contract";
import { authorSchema } from "../authors/schemas";

export const authorsContract = {
	list: oc.output(authorSchema.array()),
};
