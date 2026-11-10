import { getErrorMessage } from "@solid-imager/core/utils";
import { batch, createSignal } from "solid-js";

/** Owns one open upload draft. Requests from older drafts or file selections can never replace its files or preview. */
export function createUploadDraft(options: {
	fetchFile?: (url: string) => Promise<File>;
	createPreview: (file: File) => string;
	revokePreview: (url: string) => void;
}) {
	let active = false;
	let generation = 0;
	let requestId = 0;
	let fetchedFileUrl: string | null = null;
	let currentRequest: { url: string; promise: Promise<File | null> } | null =
		null;
	const [files, setFiles] = createSignal<File[]>([]);
	const [previewUrl, setPreviewUrl] = createSignal<string | null>(null);
	const [fetching, setFetching] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);
	const [lastFetchedUrl, setLastFetchedUrl] = createSignal<string | null>(null);
	function invalidateRequest() {
		requestId++;
		currentRequest = null;
		setFetching(false);
	}
	function replaceFiles(next: File[]) {
		const previousPreview = previewUrl();
		if (previousPreview) options.revokePreview(previousPreview);
		setFiles([...next]);
		setPreviewUrl(next[0] ? options.createPreview(next[0]) : null);
	}
	function reset(initialFiles: File[]) {
		generation++;
		fetchedFileUrl = null;
		invalidateRequest();
		setLastFetchedUrl(null);
		setError(null);
		replaceFiles(initialFiles);
	}
	async function loadUrl(url: string): Promise<File | null> {
		const fetchFile = options.fetchFile;
		if (!active || !fetchFile) return null;
		if (currentRequest?.url === url) return currentRequest.promise;
		const id = ++requestId;
		const epoch = generation;
		setFetching(true);
		setLastFetchedUrl(url);
		setError(null);
		const promise = (async () => {
			try {
				const file = await Promise.resolve().then(() => fetchFile(url));
				if (!active || epoch !== generation || id !== requestId) return null;
				fetchedFileUrl = url;
				replaceFiles([file]);
				return file;
			} catch (cause) {
				if (active && epoch === generation && id === requestId)
					setError(getErrorMessage(cause));
				return null;
			} finally {
				if (id === requestId) {
					currentRequest = null;
					setFetching(false);
				}
			}
		})();
		currentRequest = { url, promise };
		return promise;
	}
	return {
		files,
		previewUrl,
		fetching,
		error,
		setError,
		lastFetchedUrl,
		loadUrl,
		version: () => generation,
		isCurrent: (epoch: number) => active && generation === epoch,
		open: (initialFile: File | null) =>
			batch(() => {
				active = true;
				reset(initialFile ? [initialFile] : []);
			}),
		close: () =>
			batch(() => {
				active = false;
				reset([]);
			}),
		selectFiles: (next: File[]) =>
			batch(() => {
				generation++;
				fetchedFileUrl = null;
				invalidateRequest();
				setError(null);
				replaceFiles(next);
			}),
		changeUrl: (url: string) => {
			if (fetchedFileUrl && fetchedFileUrl !== url) {
				generation++;
				fetchedFileUrl = null;
				replaceFiles([]);
			}
			if (currentRequest && currentRequest.url !== url) invalidateRequest();
			if (lastFetchedUrl() !== url) setLastFetchedUrl(null);
		},
	};
}
