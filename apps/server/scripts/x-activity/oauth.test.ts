import { expect, it, spyOn } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { XOAuth } from "./oauth";

it("validates OAuth state and exchanges an S256 code, then persists rotated refresh tokens privately", async () => {
	const directory = await mkdtemp(join(tmpdir(), "x-activity-oauth-"));
	const probe = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch: () => new Response(),
	});
	const redirectUri = `http://127.0.0.1:${probe.port}/callback`;
	await probe.stop(true);
	const nativeFetch = globalThis.fetch;
	let output = "";
	const stdout = spyOn(process.stdout, "write").mockImplementation((chunk) => {
		output += String(chunk);
		return true;
	});
	const requests: URLSearchParams[] = [];
	const fetchMock = spyOn(globalThis, "fetch").mockImplementation(
		Object.assign(
			async (
				input: Parameters<typeof fetch>[0],
				init?: Parameters<typeof fetch>[1],
			) => {
				if (input !== "https://api.x.com/2/oauth2/token")
					return nativeFetch(input, init);
				expect(new Headers(init?.headers).get("Authorization")).toBe(
					`Basic ${Buffer.from("client:secret").toString("base64")}`,
				);
				if (!(init?.body instanceof URLSearchParams))
					throw new Error("Expected form-encoded token request");
				requests.push(init.body);
				return Response.json({
					access_token: `access-${requests.length}`,
					refresh_token: `refresh-${requests.length}`,
					expires_in: 7200,
				});
			},
			{ preconnect: nativeFetch.preconnect },
		),
	);
	try {
		const oauth = new XOAuth("client", directory, "secret");
		const authorized = oauth.authorize(redirectUri);
		const url = new URL(output.trim().split("\n").at(-1) ?? "");
		expect(url.searchParams.get("scope")).toBe(
			"tweet.read users.read like.read offline.access",
		);
		const wrongState = await nativeFetch(
			`${redirectUri}?code=code&state=wrong`,
		);
		expect(wrongState.status).toBe(400);
		expect(requests).toHaveLength(0);
		await nativeFetch(
			`${redirectUri}?code=code&state=${url.searchParams.get("state")}`,
		);
		await authorized;
		expect(
			createHash("sha256")
				.update(requests[0].get("code_verifier") ?? "")
				.digest("base64url"),
		).toBe(url.searchParams.get("code_challenge") ?? "");
		expect(requests[0].get("redirect_uri")).toBe(redirectUri);
		expect(await oauth.accessToken()).toBe("access-1");
		const path = join(directory, "tokens.json");
		const saved = JSON.parse(await readFile(path, "utf8"));
		expect((await stat(path)).mode & 0o777).toBe(0o600);
		await writeFile(path, JSON.stringify({ ...saved, expiresAt: 0 }));
		expect(await new XOAuth("client", directory, "secret").accessToken()).toBe(
			"access-2",
		);
		expect(requests[1].get("refresh_token")).toBe("refresh-1");
		expect(JSON.parse(await readFile(path, "utf8")).refresh_token).toBe(
			"refresh-2",
		);
	} finally {
		fetchMock.mockRestore();
		stdout.mockRestore();
		await rm(directory, { recursive: true, force: true });
	}
});
