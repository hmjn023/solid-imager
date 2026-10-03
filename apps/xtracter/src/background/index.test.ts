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
