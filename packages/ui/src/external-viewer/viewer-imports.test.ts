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

it("only clears the cancelled receipt, including cancellation before its enqueue response", async () => {
	const cancelled = { targetUrl: "https://example.org/cancelled.mp4" };
	const retained = { targetUrl: "https://example.org/retained.png" };
	const firstReceipt = { id: "removed-before-response", ...cancelled };
	const secondReceipt = { id: "removed-after-response", ...cancelled };
	const retainedReceipt = { id: "still-pending", ...retained };
	const pending = Promise.withResolvers<{
		createdRequests: (typeof firstReceipt)[];
	}>();
	const enqueue = vi
		.fn()
		.mockResolvedValueOnce({ createdRequests: [retainedReceipt] })
		.mockReturnValueOnce(pending.promise)
		.mockResolvedValueOnce({ createdRequests: [secondReceipt] });
	const imports = createViewerImports(enqueue);
	await imports.add([retained]);
	const original = imports.add([cancelled]);
	imports.clearCancelled([firstReceipt.id]);
	expect(imports.state(retained.targetUrl)).toBe("queued");
	expect(imports.state(cancelled.targetUrl)).toBe("pending");
	pending.resolve({ createdRequests: [firstReceipt] });
	await original;
	expect(imports.state(cancelled.targetUrl)).toBeUndefined();

	await imports.add([cancelled]);
	imports.clearCancelled([firstReceipt.id]);
	expect(imports.state(cancelled.targetUrl)).toBe("queued");
	expect(enqueue).toHaveBeenNthCalledWith(3, [cancelled]);
	imports.clearCancelled([secondReceipt.id]);
	expect(imports.state(cancelled.targetUrl)).toBeUndefined();
	expect(imports.state(retained.targetUrl)).toBe("queued");
});

it("reconciles tracked receipts on reconnect even if the add response arrives later", async () => {
	const approved = {
		id: "approved",
		targetUrl: "https://example.org/approved.png",
	};
	const cancelled = {
		id: "cancelled",
		targetUrl: "https://example.org/cancelled.png",
	};
	const pending = Promise.withResolvers<{
		createdRequests: (typeof cancelled)[];
	}>();
	const enqueue = vi
		.fn()
		.mockResolvedValueOnce({ createdRequests: [approved] })
		.mockReturnValueOnce(pending.promise);
	const findExisting = vi.fn().mockResolvedValue([approved.id]);
	const imports = createViewerImports(enqueue, findExisting);
	await imports.add([approved]);
	const add = imports.add([cancelled]);

	await imports.onConnected();
	expect(findExisting).toHaveBeenCalledExactlyOnceWith([approved.id]);
	pending.resolve({ createdRequests: [cancelled] });
	await add;
	await vi.waitFor(() => {
		expect(imports.state(cancelled.targetUrl)).toBeUndefined();
	});
	expect(findExisting).toHaveBeenLastCalledWith([approved.id, cancelled.id]);
	expect(imports.state(approved.targetUrl)).toBe("queued");
});
