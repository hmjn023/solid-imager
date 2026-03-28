import { z } from "zod";

export const authorSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1),
	accountId: z.string().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Author = z.infer<typeof authorSchema>;
