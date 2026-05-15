import { z } from "zod";

export const importSourceZipInputSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("path"), path: z.string() }),
	z.object({ type: z.literal("bytes"), bytes: z.array(z.number()) }),
]);

export type ImportSourceZipInput = z.infer<typeof importSourceZipInputSchema>;

export const importSourceZipResultSchema = z.object({
	success: z.literal(true),
	importedCount: z.number(),
	skippedCount: z.number(),
	errors: z.array(z.string()),
	message: z.string(),
});

export type ImportSourceZipResult = z.infer<typeof importSourceZipResultSchema>;
