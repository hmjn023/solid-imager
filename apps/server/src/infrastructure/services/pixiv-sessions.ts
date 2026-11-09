import { randomBytes } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

const loginRequired = () =>
	new ORPCError("UNAUTHORIZED", {
		message: "pixiv のログインが切れました。接続コードを取得し直してください。",
	});

const accountPage = z.object({
	props: z.object({
		pageProps: z.object({
			isLoggedIn: z.boolean(),
			gaUserData: z
				.object({ userId: z.union([z.string(), z.number()]) })
				.optional(),
			serverSerializedPreloadedState: z.string().optional(),
		}),
	}),
});

type FetchAccountPage = (url: string, init: RequestInit) => Promise<Response>;

async function fetchAccountPage(
	sessionId: string,
	fetchPage: FetchAccountPage,
) {
	let url = new URL("https://www.pixiv.net/");
	const signal = AbortSignal.timeout(10_000);
	for (let hop = 0; hop < 4; hop++) {
		const response = await fetchPage(url.href, {
			headers: {
				Cookie: "PHPSESSID=" + sessionId,
				"Cache-Control": "no-cache",
			},
			redirect: "manual",
			signal,
		});
		if (![301, 302, 303, 307, 308].includes(response.status)) return response;
		await response.body?.cancel();
		const location = response.headers.get("location");
		if (!location) throw new Error("Missing redirect location");
		const next = new URL(location, url);
		if (next.origin === "https://accounts.pixiv.net") throw loginRequired();
		if (next.origin !== url.origin || next.username || next.password)
			throw new Error("Unexpected pixiv redirect");
		url = next;
	}
	throw new Error("Too many pixiv redirects");
}

export async function verifyPixivAccount(
	sessionId: string,
	fetchPage: FetchAccountPage = fetch,
) {
	let page;
	try {
		const response = await fetchAccountPage(sessionId, fetchPage);
		if (response.status === 401) throw loginRequired();
		if (!response.ok) throw new Error();
		const html = await response.text();
		const json =
			/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/.exec(
				html,
			)?.[1];
		page = accountPage.parse(JSON.parse(json ?? "")).props.pageProps;
	} catch (error) {
		if (error instanceof ORPCError) throw error;
		throw new ORPCError("BAD_GATEWAY", {
			message: "pixiv でログイン状態を確認できませんでした。",
		});
	}
	if (!page.isLoggedIn) throw loginRequired();
	// Prefer the account itself when pixiv returns its serialized page state.
	const state = z.object({
		userData: z.object({
			self: z.object({ id: z.union([z.string(), z.number()]) }),
		}),
	});
	let userId = String(page.gaUserData?.userId ?? "");
	if (page.serverSerializedPreloadedState) {
		try {
			const parsed = state.safeParse(
				JSON.parse(page.serverSerializedPreloadedState),
			);
			if (parsed.success) userId = String(parsed.data.userData.self.id);
		} catch {
			/* The page also exposes the login ID in gaUserData. */
		}
	}
	if (!/^[1-9]\d*$/.test(userId))
		throw new ORPCError("BAD_GATEWAY", {
			message: "pixiv のユーザー ID を確認できませんでした。",
		});
	return userId;
}

type Entry = { sessionId: string; userId: string; expiresAt: number };

export function createPixivSessions(
	verify = verifyPixivAccount,
	now = Date.now,
) {
	const codes = new Map<string, Entry>();
	const sessions = new Map<string, Entry>();
	const read = (map: Map<string, Entry>, key: string) => {
		const entry = map.get(key);
		if (entry && entry.expiresAt > now()) return entry;
		map.delete(key);
	};
	// Discard expired credentials even when no client makes another request.
	let sweep: ReturnType<typeof setInterval> | undefined;
	const insert = (map: Map<string, Entry>, key: string, entry: Entry) => {
		for (const k of map.keys()) read(map, k);
		if (map.size >= 256)
			throw new ORPCError("TOO_MANY_REQUESTS", {
				message: "接続数の上限に達しました。",
			});
		map.set(key, entry);
		sweep ??= setInterval(() => {
			for (const entries of [codes, sessions])
				for (const k of entries.keys()) read(entries, k);
			if (!codes.size && !sessions.size) {
				clearInterval(sweep);
				sweep = undefined;
			}
		}, 60_000).unref();
	};
	const get = (token: string) => {
		const entry = read(sessions, token);
		if (!entry) throw loginRequired();
		return entry;
	};
	return {
		async issue(sessionId: string) {
			const userId = await verify(sessionId);
			const code = randomBytes(16).toString("base64url");
			insert(codes, code, { userId, sessionId, expiresAt: now() + 300_000 });
			return { code };
		},
		login(code: string) {
			const entry = read(codes, code);
			if (!entry)
				throw new ORPCError("BAD_REQUEST", {
					message: "接続コードが無効か、有効期限が切れています。",
				});
			const token = randomBytes(32).toString("base64url"),
				expiresAt = now() + 12 * 60 * 60 * 1000;
			insert(sessions, token, { ...entry, expiresAt });
			codes.delete(code);
			return { token, expiresAt, userId: entry.userId };
		},
		async check(token: string) {
			const entry = get(token);
			try {
				if ((await verify(entry.sessionId)) !== entry.userId)
					throw loginRequired();
			} catch (error) {
				if (error instanceof ORPCError && error.code === "UNAUTHORIZED")
					sessions.delete(token);
				throw error;
			}
			return { userId: get(token).userId };
		},
		credential: (token?: string) =>
			token === undefined ? undefined : get(token).sessionId,
		logout: (token: string) => {
			sessions.delete(token);
		},
	};
}

export const pixivSessions = createPixivSessions();

export function pixivBearerToken(header?: string | null) {
	if (!header) return undefined;
	const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header)?.[1];
	if (!token) throw loginRequired();
	return token;
}
