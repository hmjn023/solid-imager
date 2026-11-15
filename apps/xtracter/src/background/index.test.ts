import { afterEach, describe, expect, it, vi } from "vitest";

const { getClient, submitAccountVerification } = vi.hoisted(() => ({
	getClient: vi.fn(),
	submitAccountVerification: vi.fn(),
}));

vi.mock("@ext/api", async (importOriginal) => ({
	...(await importOriginal<typeof import("@ext/api")>()),
	getClient,
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
	vi.resetAllMocks();
});

describe("account verification message handler", () => {
	const message = {
		type: "SUBMIT_ACCOUNT_VERIFICATION",
		verificationId: "12345678-1234-4123-8123-123456789abc",
		profile: {
			remoteId: "18446744073709551615",
			username: "current_name",
			displayName: "Current display",
		},
	};

	async function setup() {
		type MessageListener = Parameters<
			typeof chrome.runtime.onMessage.addListener
		>[0];
		const addListener = vi.fn<(listener: MessageListener) => void>();
		vi.stubGlobal("chrome", {
			runtime: { onMessage: { addListener } },
			notifications: { create: vi.fn() },
		});
		submitAccountVerification.mockResolvedValue(undefined);
		getClient.mockResolvedValue({ authors: { submitAccountVerification } });
		await import("./index");
		const listener = addListener.mock.calls[0]?.[0];
		if (!listener) throw new Error("Background listener was not registered");
		return listener;
	}

	it.each([
		"https://x.com/current_name",
		"https://x.com/current_name#changed",
		"https://twitter.com/current_name",
	])("submits the captured token when the sender URL is %s", async (url) => {
		const listener = await setup();
		const sendResponse = vi.fn();
		expect(listener(message, { url }, sendResponse)).toBe(true);
		await vi.waitFor(() =>
			expect(sendResponse).toHaveBeenCalledWith({ success: true }),
		);
		expect(submitAccountVerification).toHaveBeenCalledExactlyOnceWith({
			verificationId: message.verificationId,
			profile: message.profile,
		});
	});

	it.each([
		"https://example.com/current_name",
		"https://x.com.example.com/current_name",
		"http://x.com/current_name",
		"https://x.com/another_user",
		"https://x.com/current_name/status/100",
		"not-a-url",
	])("rejects an untrusted sender URL %s", async (url) => {
		const listener = await setup();
		const sendResponse = vi.fn();
		listener(message, { url }, sendResponse);
		expect(sendResponse).toHaveBeenCalledWith({ success: false });
		expect(getClient).not.toHaveBeenCalled();
	});

	it("rejects an invalid captured verification token", async () => {
		const listener = await setup();
		const sendResponse = vi.fn();
		listener(
			{ ...message, verificationId: "invalid" },
			{ url: "https://x.com/current_name" },
			sendResponse,
		);
		expect(sendResponse).toHaveBeenCalledWith({ success: false });
		expect(getClient).not.toHaveBeenCalled();
	});
});

describe("operation destination snapshot", () => {
	const urlA = "https://a.example/api/rpc";
	const urlB = "https://b.example/api/rpc";
	const a = { id: "source-a", name: "twitter", type: "local" };
	const b = { id: "source-b", name: "twitter", type: "local" };
	const post = {
		type: "POST_BULK",
		data: [{ targetUrl: "https://images.example/image.png" }],
	};
	async function setup() {
		type MessageListener = Parameters<
			typeof chrome.runtime.onMessage.addListener
		>[0];
		const addListener = vi.fn<(listener: MessageListener) => void>();
		const stored: Record<string, unknown> = {
			connectionSettings: {
				apiUrl: urlA,
				generation: 0,
				selectedSourceIds: { [urlA]: a.id, [urlB]: b.id },
			},
		};
		const notifications = vi.fn();
		vi.stubGlobal("chrome", {
			runtime: { onMessage: { addListener } },
			storage: {
				local: {
					get: vi.fn(async () => structuredClone(stored)),
					set: vi.fn(async (value: object) => {
						Object.assign(stored, value);
					}),
				},
			},
			notifications: { create: notifications },
		});
		const clientA = {
			sources: { list: vi.fn().mockResolvedValue([a]) },
			downloads: { start: vi.fn().mockResolvedValue({}) },
		};
		const clientB = {
			sources: { list: vi.fn().mockResolvedValue([b]) },
			downloads: { start: vi.fn().mockResolvedValue({}) },
		};
		getClient.mockImplementation(async (url: string) =>
			url === urlA ? clientA : clientB,
		);
		await import("./index");
		const listener = addListener.mock.calls[0]?.[0];
		if (!listener) throw new Error("No listener");
		const switchToB = () => {
			stored.connectionSettings = {
				apiUrl: urlB,
				generation: 1,
				selectedSourceIds: { [urlA]: a.id, [urlB]: b.id },
			};
		};
		return { listener, stored, clientA, clientB, switchToB, notifications };
	}

	it("keeps source and client on A when settings change while the source list is pending", async () => {
		const { listener, clientA, clientB, switchToB } = await setup();
		let finish!: (value: (typeof a)[]) => void;
		clientA.sources.list.mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		listener(post, {}, vi.fn());
		await vi.waitFor(() =>
			expect(clientA.sources.list).toHaveBeenCalledTimes(1),
		);
		switchToB();
		finish([a]);
		await vi.waitFor(() =>
			expect(clientA.downloads.start).toHaveBeenCalledExactlyOnceWith({
				mediaSourceId: a.id,
				items: post.data,
			}),
		);
		expect(clientB.downloads.start).not.toHaveBeenCalled();
		expect(getClient).toHaveBeenCalledExactlyOnceWith(urlA);
	});

	it("retries on the original client after a connection edit", async () => {
		const { listener, clientA, clientB, switchToB } = await setup();
		const { APIError } = await import("@ext/api");
		clientA.downloads.start.mockRejectedValueOnce(
			new APIError("offline", "NETWORK_ERROR"),
		);
		listener(post, {}, vi.fn());
		await vi.waitFor(() =>
			expect(clientA.downloads.start).toHaveBeenCalledTimes(1),
		);
		switchToB();
		await vi.waitFor(
			() => expect(clientA.downloads.start).toHaveBeenCalledTimes(2),
			{ timeout: 2000 },
		);
		expect(clientB.downloads.start).not.toHaveBeenCalled();
		expect(getClient).toHaveBeenCalledExactlyOnceWith(urlA);
	});

	it("distinguishes source lookup failure from an empty list and never posts to a saved unchecked ID", async () => {
		const { listener, clientA, notifications } = await setup();
		clientA.sources.list.mockRejectedValue(new Error("server offline"));
		const response = vi.fn();
		listener({ type: "GET_SOURCES" }, {}, response);
		listener(post, {}, vi.fn());
		await vi.waitFor(() =>
			expect(response).toHaveBeenCalledWith({
				success: false,
				error: "server offline",
			}),
		);
		await vi.waitFor(() => expect(notifications).toHaveBeenCalled());
		expect(clientA.downloads.start).not.toHaveBeenCalled();
		clientA.sources.list.mockResolvedValue([]);
		response.mockClear();
		listener({ type: "GET_SOURCES" }, {}, response);
		await vi.waitFor(() =>
			expect(response).toHaveBeenCalledWith(
				expect.objectContaining({
					success: true,
					sources: [],
					selectedSourceId: null,
				}),
			),
		);
	});

	it.each(["NETWORK_ERROR", "TIMEOUT"] as const)(
		"retries transient %s source lookup using the captured server and selection",
		async (code) => {
			const { listener, stored, clientA, clientB, switchToB, notifications } =
				await setup();
			const { APIError } = await import("@ext/api");
			vi.useFakeTimers();
			try {
				clientA.sources.list.mockRejectedValueOnce(
					new APIError("temporary lookup failure", code),
				);
				listener(post, {}, vi.fn());
				await vi.waitFor(() =>
					expect(clientA.sources.list).toHaveBeenCalledTimes(1),
				);
				switchToB();
				// Even editing A's saved selection must not redirect this operation.
				const settings = stored.connectionSettings as {
					selectedSourceIds: Record<string, string>;
				};
				settings.selectedSourceIds[urlA] = "another-source";
				await vi.advanceTimersByTimeAsync(1000);
				expect(clientA.sources.list).toHaveBeenCalledTimes(2);
				expect(clientA.downloads.start).toHaveBeenCalledExactlyOnceWith({
					mediaSourceId: a.id,
					items: post.data,
				});
				expect(clientB.sources.list).not.toHaveBeenCalled();
				expect(clientB.downloads.start).not.toHaveBeenCalled();
				expect(getClient).toHaveBeenCalledExactlyOnceWith(urlA);
				expect(notifications).toHaveBeenCalledWith(
					expect.objectContaining({
						message: "1件のダウンロードを登録しました",
					}),
				);
			} finally {
				vi.useRealTimers();
			}
		},
	);

	it("stops after bounded lookup retries without posting an unchecked saved source", async () => {
		const { listener, clientA, notifications } = await setup();
		const { APIError } = await import("@ext/api");
		vi.useFakeTimers();
		try {
			clientA.sources.list.mockRejectedValue(
				new APIError("offline", "NETWORK_ERROR"),
			);
			listener(post, {}, vi.fn());
			await vi.waitFor(() =>
				expect(clientA.sources.list).toHaveBeenCalledTimes(1),
			);
			await vi.advanceTimersByTimeAsync(3000);
			expect(clientA.sources.list).toHaveBeenCalledTimes(3);
			expect(clientA.downloads.start).not.toHaveBeenCalled();
			expect(notifications).toHaveBeenCalledWith(
				expect.objectContaining({ title: "xtracterのエラー" }),
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it("uses the same fallback for the popup and POST, restores each server's selection, and rejects stale selection writes", async () => {
		const { listener, clientA } = await setup();
		clientA.sources.list.mockResolvedValue([
			{ id: "first", name: "first", type: "local" },
			a,
		]);
		const popup = vi.fn();
		listener({ type: "GET_SOURCES" }, {}, popup);
		listener(post, {}, vi.fn());
		await vi.waitFor(() =>
			expect(popup).toHaveBeenCalledWith(
				expect.objectContaining({ selectedSourceId: a.id }),
			),
		);
		await vi.waitFor(() =>
			expect(clientA.downloads.start).toHaveBeenCalledWith({
				mediaSourceId: a.id,
				items: post.data,
			}),
		);
		const changed = vi.fn();
		listener({ type: "SET_API_URL", apiUrl: urlB }, {}, changed);
		await vi.waitFor(() =>
			expect(changed).toHaveBeenCalledWith(
				expect.objectContaining({
					apiUrl: urlB,
					generation: 1,
					selectedSourceId: b.id,
				}),
			),
		);
		const stale = vi.fn();
		listener(
			{ type: "SET_SOURCE", apiUrl: urlA, generation: 0, sourceId: "first" },
			{},
			stale,
		);
		await vi.waitFor(() =>
			expect(stale).toHaveBeenCalledWith(
				expect.objectContaining({ success: false }),
			),
		);
		const restored = vi.fn();
		listener({ type: "SET_API_URL", apiUrl: urlA }, {}, restored);
		await vi.waitFor(() =>
			expect(restored).toHaveBeenCalledWith(
				expect.objectContaining({
					apiUrl: urlA,
					generation: 2,
					selectedSourceId: a.id,
				}),
			),
		);
	});
});
