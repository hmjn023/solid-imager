import { describe, expect, it, vi } from "vitest";
import { createUploadDraft } from "./upload-draft";

function deferred<T>() {
	let resolve: (value: T) => void = () => {};
	let reject: (reason: Error) => void = () => {};
	const promise = new Promise<T>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
}
function setup(fetchFile = vi.fn(async () => new File(["url"], "url.png"))) {
	const createPreview = vi.fn((file: File) => `blob:${file.name}`);
	const revokePreview = vi.fn();
	const draft = createUploadDraft({ fetchFile, createPreview, revokePreview });
	draft.open(null);
	return { draft, fetchFile, createPreview, revokePreview };
}

describe("upload draft ownership", () => {
	it("can retry a URL provider that throws synchronously", async () => {
		const fetchFile = vi
			.fn(async () => new File(["ok"], "ok.png"))
			.mockImplementationOnce(() => {
				throw new Error("failed");
			});
		const { draft } = setup(fetchFile);
		expect(await draft.loadUrl("https://example.com/file.png")).toBeNull();
		expect(draft.error()).toBe("failed");
		expect((await draft.loadUrl("https://example.com/file.png"))?.name).toBe(
			"ok.png",
		);
		expect(draft.error()).toBeNull();
	});
	it("keeps all selected files and owns a copy of the selection", () => {
		const { draft } = setup();
		const first = new File(["a"], "a.png");
		const second = new File(["b"], "b.png");
		const selection = [first, second];
		draft.selectFiles(selection);
		selection.pop();
		expect(draft.files()).toEqual([first, second]);
		expect(draft.previewUrl()).toBe("blob:a.png");
	});
	it("invalidates old URL results when a file selection replaces the request", async () => {
		const pending = deferred<File>();
		const { draft, createPreview } = setup(vi.fn(() => pending.promise));
		const request = draft.loadUrl("https://example.com/old.png");
		const selected = new File(["selected"], "selected.png");
		draft.selectFiles([selected]);
		pending.resolve(new File(["old"], "old.png"));
		expect(await request).toBeNull();
		expect(draft.files()).toEqual([selected]);
		expect(draft.fetching()).toBe(false);
		expect(createPreview).toHaveBeenCalledExactlyOnceWith(selected);
	});
	it("does not carry a discarded request into a reopened draft", async () => {
		const pending = deferred<File>();
		const { draft } = setup(vi.fn(() => pending.promise));
		const request = draft.loadUrl("https://example.com/old.png");
		draft.close();
		const next = new File(["next"], "next.png");
		draft.open(next);
		pending.resolve(new File(["old"], "old.png"));
		expect(await request).toBeNull();
		expect(draft.files()).toEqual([next]);
		expect(draft.previewUrl()).toBe("blob:next.png");
	});
	it("allows the newest URL to finish first and ignores old errors and loading completion", async () => {
		const first = deferred<File>();
		const second = deferred<File>();
		const { draft } = setup(
			vi
				.fn()
				.mockReturnValueOnce(first.promise)
				.mockReturnValueOnce(second.promise),
		);
		const old = draft.loadUrl("https://example.com/old.png");
		draft.changeUrl("https://example.com/new.png");
		const current = draft.loadUrl("https://example.com/new.png");
		first.reject(new Error("old failure"));
		await old;
		expect(draft.fetching()).toBe(true);
		expect(draft.error()).toBeNull();
		const next = new File(["new"], "new.png");
		second.resolve(next);
		expect(await current).toBe(next);
		expect(draft.files()).toEqual([next]);
		expect(draft.fetching()).toBe(false);
	});
	it("shares a URL fetch between automatic loading and form submission", async () => {
		const pending = deferred<File>();
		const { draft, fetchFile } = setup(vi.fn(() => pending.promise));
		const automatic = draft.loadUrl("https://example.com/file.png");
		const submit = draft.loadUrl("https://example.com/file.png");
		const file = new File(["url"], "url.png");
		pending.resolve(file);
		expect(await automatic).toBe(file);
		expect(await submit).toBe(file);
		expect(fetchFile).toHaveBeenCalledOnce();
	});
	it("clears a fetched file when its URL changes, while preserving manual selections", async () => {
		const { draft, revokePreview } = setup();
		await draft.loadUrl("https://example.com/old.png");
		draft.changeUrl("https://example.com/new.png");
		expect(draft.files()).toEqual([]);
		expect(revokePreview).toHaveBeenCalledWith("blob:url.png");
		const manual = new File(["manual"], "manual.png");
		draft.selectFiles([manual]);
		draft.changeUrl("https://example.com/reference");
		expect(draft.files()).toEqual([manual]);
	});
	it("invalidates pending submission callbacks after discard or selection changes and releases previews", () => {
		const { draft, revokePreview } = setup();
		const original = new File(["a"], "a.png");
		draft.selectFiles([original]);
		const submission = draft.version();
		draft.selectFiles([new File(["b"], "b.png")]);
		expect(draft.isCurrent(submission)).toBe(false);
		const nextSubmission = draft.version();
		draft.close();
		draft.open(original);
		expect(draft.isCurrent(nextSubmission)).toBe(false);
		expect(revokePreview.mock.calls.flat()).toEqual([
			"blob:a.png",
			"blob:b.png",
		]);
	});
});
