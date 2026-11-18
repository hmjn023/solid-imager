import { z } from "zod";

export const TAG_DICTIONARY_JOB = "tag_dictionary_refresh";
export const tagDictionaryJobPayloadSchema = z.object({
	trigger: z.enum(["manual", "automatic"]),
});
