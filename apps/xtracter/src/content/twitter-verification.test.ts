import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe("X profile verification transport", () => {
	async function setup(hash: string) {
		const listeners: ((event: MessageEvent) => void)[] = [];
		const sendMessage = vi.fn().mockResolvedValue({ success: true });
		const response = (payload: object) => {
			const result = new Response(JSON.stringify(payload), {
				headers: { "content-type": "application/json" },
			});
			Object.defineProperty(result, "url", {
				value: "https://x.com/i/api/graphql/query/UserByScreenName",
			});
			return result;
		};
		let payload: object = {};
		const fakeWindow = {
			location: {
				origin: "https://x.com",
				hostname: "x.com",
				pathname: "/current_name",
				hash,
			},
			addEventListener: (
				_type: string,
				callback: (event: MessageEvent) => void,
			) => listeners.push(callback),
			postMessage: vi.fn((data: object) => {
				queueMicrotask(() =>
					listeners.forEach((callback) =>
						callback({
							source: fakeWindow,
							origin: "https://x.com",
							data,
						} as unknown as MessageEvent),
					),
				);
			}),
			fetch: vi.fn(async () => response(payload)),
		};
		vi.stubGlobal("window", fakeWindow);
		vi.stubGlobal("chrome", { runtime: { sendMessage } });
		vi.stubGlobal(
			"XMLHttpRequest",
			class {
				send() {}
			},
		);
		await import("./twitter-network");
		const { observeTwitterAccounts } = await import("./twitter-account-cache");
		observeTwitterAccounts();
		return {
			sendMessage,
			observe: async (value: object) => {
				payload = value;
				await fakeWindow.fetch();
			},
			fakeWindow,
		};
	}
	const profile = (username: string) => ({
		data: {
			user: {
				result: {
					__typename: "User",
					rest_id: "18446744073709551615",
					core: { name: "Current display", screen_name: username },
				},
			},
		},
	});
	it.each(["", "#changed"])(
		"passes the captured token once after the page hash changes to %s",
		async (hash) => {
			const verificationId = "12345678-1234-4123-8123-123456789abc";
			const { observe, sendMessage, fakeWindow } = await setup(
				`#solid-imager-account-verification=${verificationId}`,
			);
			fakeWindow.location.hash = hash;
			await observe(profile("another_user"));
			await observe(profile("current_name"));
			await vi.waitFor(() =>
				expect(sendMessage).toHaveBeenCalledExactlyOnceWith({
					type: "SUBMIT_ACCOUNT_VERIFICATION",
					verificationId,
					profile: {
						remoteId: "18446744073709551615",
						username: "current_name",
						displayName: "Current display",
					},
				}),
			);
			await observe(profile("current_name"));
			expect(sendMessage).toHaveBeenCalledTimes(1);
		},
	);
	it("does not submit normally browsed profiles without a Manager verification token", async () => {
		const { observe, sendMessage, fakeWindow } = await setup("");
		await observe(profile("current_name"));
		// Wait until both the response observer and replay message have run.
		await vi.waitFor(() =>
			expect(fakeWindow.postMessage).toHaveBeenCalledWith(
				{
					channel: "solid-imager-xtracter-twitter-profile",
					profile: {
						remoteId: "18446744073709551615",
						username: "current_name",
						displayName: "Current display",
					},
				},
				"https://x.com",
			),
		);
		expect(sendMessage).not.toHaveBeenCalled();
	});
});
