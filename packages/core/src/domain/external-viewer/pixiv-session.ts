import { z } from "zod";

export const pixivCodeSchema = z.object({
	code: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
});
export const pixivViewerSessionSchema = z.object({
	token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
	userId: z.string().regex(/^[1-9]\d*$/),
	expiresAt: z.number().int().positive(),
});
export type PixivViewerSession = z.infer<typeof pixivViewerSessionSchema>;

/** Cookie value as supplied by the browser, preserving percent escapes. */
export const pixivWebSessionSchema = z
	.string()
	.max(512)
	.regex(/^[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]+$/);

export function canTransferPixivSession(server: URL) {
	return (
		!server.username &&
		!server.password &&
		(server.protocol === "https:" ||
			(server.protocol === "http:" &&
				["localhost", "127.0.0.1", "[::1]"].includes(server.hostname)))
	);
}
