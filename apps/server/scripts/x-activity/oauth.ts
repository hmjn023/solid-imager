import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { logger } from "../../src/infrastructure/logger";

const tokenSchema = z.object({
	access_token: z.string(),
	refresh_token: z.string().optional(),
	expires_in: z.number().positive(),
});
const savedTokenSchema = tokenSchema.omit({ expires_in: true }).extend({
	expiresAt: z.number(),
	clientId: z.string(),
});
type SavedToken = z.infer<typeof savedTokenSchema>;

export class XOAuth {
	private token?: SavedToken;
	private readonly tokenPath: string;

	constructor(
		private readonly clientId: string,
		private readonly directory: string,
		private readonly clientSecret?: string,
	) {
		this.tokenPath = join(directory, "tokens.json");
	}

	private async exchange(parameters: Record<string, string>): Promise<void> {
		const headers = new Headers({
			"Content-Type": "application/x-www-form-urlencoded",
		});
		if (this.clientSecret) {
			headers.set(
				"Authorization",
				`Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
			);
		}
		const response = await fetch("https://api.x.com/2/oauth2/token", {
			method: "POST",
			headers,
			body: new URLSearchParams({ client_id: this.clientId, ...parameters }),
			signal: AbortSignal.timeout(30_000),
		});
		// Token endpoint responses may contain credentials, including on errors.
		if (!response.ok)
			throw new Error(
				`X token exchange failed (HTTP ${response.status}). Check app credentials or run auth again.`,
			);
		const token = tokenSchema.parse(await response.json());
		const saved: SavedToken = {
			access_token: token.access_token,
			refresh_token: token.refresh_token ?? this.token?.refresh_token,
			expiresAt: Date.now() + token.expires_in * 1000,
			clientId: this.clientId,
		};
		await mkdir(this.directory, { recursive: true, mode: 0o700 });
		const temporaryPath = `${this.tokenPath}.${randomBytes(8).toString("hex")}.tmp`;
		await writeFile(temporaryPath, JSON.stringify(saved), { mode: 0o600 });
		await rename(temporaryPath, this.tokenPath);
		this.token = saved;
	}

	async accessToken(): Promise<string> {
		if (!this.token) {
			if (!existsSync(this.tokenPath))
				throw new Error("Run the auth command first.");
			this.token = savedTokenSchema.parse(
				JSON.parse(await readFile(this.tokenPath, "utf8")),
			);
		}
		if (this.token.clientId !== this.clientId)
			throw new Error("X_CLIENT_ID changed. Run auth again.");
		if (this.token.expiresAt <= Date.now() + 60_000) {
			if (!this.token.refresh_token)
				throw new Error("No refresh token. Run auth again.");
			await this.exchange({
				grant_type: "refresh_token",
				refresh_token: this.token.refresh_token,
			});
		}
		return this.token.access_token;
	}

	async authorize(redirectUri: string): Promise<void> {
		const redirect = new URL(redirectUri);
		if (
			redirect.protocol !== "http:" ||
			redirect.hostname !== "127.0.0.1" ||
			!redirect.port ||
			redirect.search ||
			redirect.hash
		) {
			throw new Error(
				"X_REDIRECT_URI must be http://127.0.0.1:<port>/<callback-path>.",
			);
		}
		const verifier = randomBytes(32).toString("base64url");
		const state = randomBytes(32).toString("base64url");
		const authorization = new URL("https://x.com/i/oauth2/authorize");
		authorization.search = new URLSearchParams({
			response_type: "code",
			client_id: this.clientId,
			redirect_uri: redirectUri,
			scope: "tweet.read users.read like.read offline.access",
			state,
			code_challenge: createHash("sha256").update(verifier).digest("base64url"),
			code_challenge_method: "S256",
		}).toString();
		const callback = Promise.withResolvers<string>();
		let received = false;
		const server = Bun.serve({
			hostname: "127.0.0.1",
			port: Number(redirect.port),
			fetch(request) {
				const url = new URL(request.url);
				if (request.method !== "GET" || url.pathname !== redirect.pathname)
					return new Response("Not found", { status: 404 });
				if (url.searchParams.get("state") !== state || received)
					return new Response("Invalid OAuth state", { status: 400 });
				const code = url.searchParams.get("code");
				if (url.searchParams.has("error") || !code) {
					received = true;
					callback.reject(
						new Error("X authorization was declined or returned no code."),
					);
					return new Response("Authorization failed. Check the terminal.", {
						status: 400,
					});
				}
				received = true;
				callback.resolve(code);
				return new Response(
					"Authorization received. You can close this tab and check the terminal.",
				);
			},
		});
		const timeout = setTimeout(
			() =>
				callback.reject(
					new Error("OAuth callback timed out after five minutes."),
				),
			300_000,
		);
		try {
			process.stdout.write(
				`Open this URL in your browser:\n${authorization}\n`,
			);
			const code = await callback.promise;
			await this.exchange({
				grant_type: "authorization_code",
				code,
				redirect_uri: redirectUri,
				code_verifier: verifier,
			});
			logger.info({ tokenPath: this.tokenPath }, "X authorization saved");
		} finally {
			clearTimeout(timeout);
			await server.stop(true);
		}
	}
}
