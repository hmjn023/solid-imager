import { z } from "zod";

/** Frame names are local archive entries, never paths or FFmpeg directives. */
const ugoiraFrameSchema = z.object({
	file: z.string().regex(/^\d+\.(?:jpe?g|png|gif)$/i),
	delay: z.number().int().min(1).max(60_000),
});

export const ugoiraMetadataSchema = z
	.object({
		frames: z.array(ugoiraFrameSchema).min(1).max(10_000),
	})
	.superRefine(({ frames }, ctx) => {
		if (new Set(frames.map(({ file }) => file)).size !== frames.length) {
			ctx.addIssue({
				code: "custom",
				message: "Ugoira frame filenames must be unique",
				path: ["frames"],
			});
		}
		if (frames.reduce((total, frame) => total + frame.delay, 0) > 3_600_000) {
			ctx.addIssue({
				code: "custom",
				message: "Ugoira duration must not exceed one hour",
				path: ["frames"],
			});
		}
	});

export type UgoiraMetadata = z.infer<typeof ugoiraMetadataSchema>;
