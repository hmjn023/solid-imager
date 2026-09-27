import { z } from "zod";
import { authorPlatformSchema } from "../media/schemas";

export const authorSchema = z.object({
	id: z.uuid(),
	name: z.string().min(1),
	accountId: z.string().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Author = z.infer<typeof authorSchema>;

export const authorAccountSchema = z.object({
	id: z.uuid(),
	authorId: z.uuid(),
	platform: authorPlatformSchema,
	accountId: z.string().min(1),
	profileUrl: z.url().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type AuthorAccount = z.infer<typeof authorAccountSchema>;
