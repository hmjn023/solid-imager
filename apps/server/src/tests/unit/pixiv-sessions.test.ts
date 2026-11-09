import { describe, expect, it, vi } from "vitest";
import { call, ORPCError } from "@orpc/server";
import {
	pixivCodeSchema,
	canTransferPixivSession,
	pixivWebSessionSchema,
} from "@solid-imager/core/external-viewer";
import {
	createPixivSessions,
	verifyPixivAccount,
} from "~/infrastructure/services/pixiv-sessions";
import { viewerRouter } from "~/infrastructure/api/routers/viewer-router";
import { servePixivAnimation } from "~/infrastructure/services/pixiv-animation";

function accountPage(userId: string) {
	const data = JSON.stringify({
		props: { pageProps: { isLoggedIn: !!userId, gaUserData: { userId } } },
	});
	return new Response(
		'<script id="__NEXT_DATA__" type="application/json">' + data + "</script>",
	);
}

describe("pixiv account connection", () => {
	it("binds verified pixiv sessions to separate, single-use codes and revocable viewer tokens", async () => {
		let now = 0;
		const store = createPixivSessions(
			async (value) => (value === "session-A" ? "42" : "93"),
			() => now,
		);
		const code = await store.issue("session-A");
		expect(pixivCodeSchema.parse(code)).toEqual(code);
		const a = store.login(code.code);
		expect(a.userId).toBe("42");
		expect(() => store.login(code.code)).toThrow();
		const b = store.login((await store.issue("session-B")).code);
		expect(store.credential(a.token)).toBe("session-A");
		expect(store.credential(b.token)).toBe("session-B");
		expect(store.credential()).toBeUndefined();
		expect(await store.check(a.token)).toEqual({ userId: "42" });
		store.logout(a.token);
		expect(() => store.credential(a.token)).toThrow();
		expect(store.credential(b.token)).toBe("session-B");
		const expiredCode = await store.issue("session-A");
		now += 300_000;
		expect(() => store.login(expiredCode.code)).toThrow();
		now = b.expiresAt;
		expect(() => store.credential(b.token)).toThrow();
	});

	it("revokes an upstream-rejected session but preserves it across temporary network errors", async () => {
		const verify = vi.fn(async () => "123");
		const store = createPixivSessions(verify);
		const session = store.login((await store.issue("cookie")).code);
		verify.mockRejectedValueOnce(new Error("timeout"));
		await expect(store.check(session.token)).rejects.toThrow("timeout");
		expect(store.credential(session.token)).toBe("cookie");
		verify.mockRejectedValueOnce(new ORPCError("UNAUTHORIZED"));
		await expect(store.check(session.token)).rejects.toThrow();
		expect(() => store.credential(session.token)).toThrow();
	});

	it("admits concurrent codes per verified account and releases the slots when they expire", async () => {
		let now = 0;
		const store = createPixivSessions(
			async (cookie) => (cookie === "other-cookie" ? "93" : "42"),
			() => now,
		);
		const issued = await Promise.allSettled(
			Array.from({ length: 9 }, (_, i) => store.issue(`cookie-${i}`)),
		);
		expect(
			issued.filter((result) => result.status === "fulfilled"),
		).toHaveLength(8);
		expect(
			issued.filter((result) => result.status === "rejected"),
		).toMatchObject([{ reason: { code: "TOO_MANY_REQUESTS" } }]);
		const other = store.login((await store.issue("other-cookie")).code);
		expect(other.userId).toBe("93");
		now += 300_000;
		expect(store.login((await store.issue("fresh-cookie")).code).userId).toBe(
			"42",
		);
	});

	it("keeps other accounts available and preserves a login code until a viewer slot opens", async () => {
		const store = createPixivSessions(async (cookie) =>
			cookie === "other-cookie" ? "93" : "42",
		);
		const sessions = await Promise.all(
			Array.from({ length: 8 }, async (_, i) =>
				store.login((await store.issue(`cookie-${i}`)).code),
			),
		);
		const waiting = await store.issue("waiting-cookie");
		expect(() => store.login(waiting.code)).toThrow(
			expect.objectContaining({ code: "TOO_MANY_REQUESTS" }),
		);
		const other = store.login((await store.issue("other-cookie")).code);
		expect(store.credential(other.token)).toBe("other-cookie");
		store.logout(sessions[0].token);
		const connected = store.login(waiting.code);
		expect(store.credential(connected.token)).toBe("waiting-cookie");
		expect(() => store.login(waiting.code)).toThrow(
			expect.objectContaining({ code: "BAD_REQUEST" }),
		);
	});

	it("rejects anonymous pages, transport failure and malformed upstream responses", async () => {
		await expect(
			verifyPixivAccount("123_fake", async () => accountPage("")),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		await expect(
			verifyPixivAccount("cookie", async () => new Response("maintenance")),
		).rejects.toMatchObject({ code: "BAD_GATEWAY" });
		await expect(
			verifyPixivAccount(
				"cookie",
				async () => new Response(null, { status: 503 }),
			),
		).rejects.toMatchObject({ code: "BAD_GATEWAY" });
	});

	it("follows locale redirects only on the pixiv origin", async () => {
		const fetchPage = vi.fn(async (url: string) =>
			url.endsWith("/en/")
				? accountPage("42")
				: Response.redirect("https://www.pixiv.net/en/"),
		);
		expect(await verifyPixivAccount("fixture", fetchPage)).toBe("42");
		expect(fetchPage).toHaveBeenCalledTimes(2);
		for (const [location, code] of [
			["https://accounts.pixiv.net/login", "UNAUTHORIZED"],
			["https://elsewhere.example/", "BAD_GATEWAY"],
		]) {
			const redirect = vi.fn(async () => Response.redirect(location));
			await expect(
				verifyPixivAccount("fixture", redirect),
			).rejects.toMatchObject({ code });
			expect(redirect).toHaveBeenCalledTimes(1);
		}
	});

	it("carries credentials through the real viewer router only for the connected viewer", async () => {
		const remote = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (url, init) => {
				const upstream = new URL(url instanceof Request ? url.url : url);
				expect(upstream.origin).toBe("https://www.pixiv.net");
				expect(init?.redirect).toBe(
					upstream.pathname === "/" ? "manual" : "error",
				);
				const header = new Headers(init?.headers).get("cookie");
				if (upstream.pathname === "/") {
					expect(header).toBe("PHPSESSID=123_fixture%3Avalue");
					return accountPage("123");
				}
				return Response.json({
					contents: [
						{
							illust_id: 1,
							title: header ? "account" : "guest",
							user_name: "artist",
							url: "",
							illust_page_count: 1,
						},
					],
					next: false,
				});
			});
		try {
			const code = await call(viewerRouter.issuePixivCode, {
				sessionId: "123_fixture%3Avalue",
			});
			const session = await call(viewerRouter.loginPixiv, code);
			const context = { pixivAuthorization: "Bearer " + session.token };
			const input = { provider: "pixiv" as const, tags: "", page: 1 };
			expect(
				(await call(viewerRouter.search, input, { context })).posts[0],
			).toMatchObject({ title: "account" });
			expect((await call(viewerRouter.search, input)).posts[0]).toMatchObject({
				title: "guest",
			});
			expect(
				await call(viewerRouter.checkPixivSession, undefined, { context }),
			).toEqual({ userId: "123" });
			await call(viewerRouter.logoutPixiv, undefined, { context });
			await expect(
				call(viewerRouter.search, input, { context }),
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
			expect(
				(await servePixivAnimation(1, context.pixivAuthorization)).status,
			).toBe(401);
		} finally {
			remote.mockRestore();
		}
	});

	it("limits account transfer to trusted transports and a single cookie value", () => {
		for (const url of [
			"https://imager.example",
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"http://[::1]:3000",
		])
			expect(canTransferPixivSession(new URL(url))).toBe(true);
		for (const url of [
			"http://imager.example",
			"http://localhost.example",
			"https://user:pw@imager.example",
		])
			expect(canTransferPixivSession(new URL(url))).toBe(false);
		for (const cookie of ["", "123; another=value", "123\r\nother"])
			expect(pixivWebSessionSchema.safeParse(cookie).success).toBe(false);
	});
});
