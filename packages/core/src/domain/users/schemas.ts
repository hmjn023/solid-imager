import { z } from "zod";

export const userSchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	email: z.string().email(),
	password: z.string(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export const newUserSchema = userSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const updateUserSchema = newUserSchema.partial();

export type User = z.infer<typeof userSchema>;
export type NewUser = z.infer<typeof newUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
