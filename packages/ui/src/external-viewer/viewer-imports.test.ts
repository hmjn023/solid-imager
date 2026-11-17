import { expect, it, vi } from "vitest";
import { toast } from "../toast";
import { createViewerImports } from "./viewer-imports";

vi.mock("../toast", () => ({
	toast: { error: vi.fn(), success: vi.fn() },
}));

it("retries failed pages without re-queuing pages from an overlapping submission", async () => {
	const first = { targetUrl: "https://example.org/1.jpg" };
	const second = { targetUrl: "https://example.org/2.jpg" };
	const third = { targetUrl: "https://example.org/3.jpg" };
	const pending = Promise.withResolvers<void>();
	const enqueue = vi
		.fn()
		.mockReturnValueOnce(pending.promise)
		.mockResolvedValue(undefined);
	const imports = createViewerImports(enqueue);

	const original = imports.add([first, {}, second, first]);
	expect(enqueue).toHaveBeenCalledExactlyOnceWith([first, second]);
	expect(imports.state(first.targetUrl)).toBe("pending");
	await imports.add([second, third]);
	expect(enqueue).toHaveBeenNthCalledWith(2, [third]);

	pending.reject(new Error("Unavailable"));
	await original;
	expect(imports.state(first.targetUrl)).toBeUndefined();
	expect(imports.state(second.targetUrl)).toBeUndefined();
	expect(imports.state(third.targetUrl)).toBe("queued");
	expect(toast.error).toHaveBeenCalledOnce();

	await imports.add([first, second, third]);
	expect(enqueue).toHaveBeenNthCalledWith(3, [first, second]);
	await imports.add([first, second, third]);
	expect(enqueue).toHaveBeenCalledTimes(3);
	expect(toast.success).toHaveBeenCalledTimes(2);
});
