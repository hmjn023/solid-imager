import { z } from "zod";

export const searchHistoryQuerySchema = z.object({
	search: z.uuid().optional(),
});
