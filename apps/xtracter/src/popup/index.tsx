import { getClient } from "@ext/api";
import {
	downloadItemSchema,
	type DownloadItem,
	type MediaSource,
} from "@ext/schema";
import { resolveEffectiveSourceId } from "@ext/utils/source-selection";
import { createSignal, For, onMount, Show } from "solid-js";
import { render } from "solid-js/web";

const DEFAULT_API_URL = "http://localhost:3000/api/rpc";

function Popup() {
	const [apiUrl, setApiUrl] = createSignal(DEFAULT_API_URL);
	const [sources, setSources] = createSignal<MediaSource[]>([]);
	const [selectedSourceId, setSelectedSourceId] = createSignal("");
	const [status, setStatus] = createSignal("");
	const [statusType, setStatusType] = createSignal<
		"info" | "success" | "error"
	>("info");
	const [isLoading, setIsLoading] = createSignal(false);
	const [exportStatus, setExportStatus] = createSignal("");
	const [uploadStatus, setUploadStatus] = createSignal("");

	let selectRef: HTMLSelectElement | undefined;
	let fetchSeq = 0;

	const loadSettings = async () => {
		const settings: { apiUrl?: string; selectedSourceId?: string } =
			await chrome.storage.local.get(["selectedSourceId", "apiUrl"]);
		if (settings.apiUrl) setApiUrl(settings.apiUrl);

		await fetchSources(settings.selectedSourceId);
	};

	const fetchSources = async (preferredId?: string) => {
		const seq = ++fetchSeq;
		setIsLoading(true);
		setStatus("Loading sources...");
		setStatusType("info");

		try {
			const resp: MediaSource[] = await chrome.runtime.sendMessage({
				type: "GET_SOURCES",
			});
			if (seq !== fetchSeq) return;
			setSources(resp || []);

			const previousId = preferredId ?? selectedSourceId();
			const resolved = resolveEffectiveSourceId(resp ?? [], previousId);
			if (resolved) {
				setSelectedSourceId(resolved.id);
				if (selectRef) selectRef.value = resolved.id;
				if (resolved.id !== previousId) {
					await chrome.storage.local.set({ selectedSourceId: resolved.id });
				}
			}
			setStatus("");
		} catch (_err) {
			if (seq !== fetchSeq) return;
			setStatus("Failed to load sources. Check API URL.");
			setStatusType("error");
		} finally {
			if (seq === fetchSeq) setIsLoading(false);
		}
	};

	const handleExport = async () => {
		setExportStatus("Requesting data...");
		try {
			await chrome.runtime.sendMessage({ type: "DOWNLOAD_JSON_FROM_POPUP" });
			setExportStatus("Download started!");
			setTimeout(() => setExportStatus(""), 3000);
		} catch (_err) {
			setExportStatus("Failed. Are you on X.com?");
		}
	};

	const handleBulkUpload = async () => {
		setUploadStatus("Fetching metadata...");
		try {
			const tabs = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});
			const activeTabId = tabs[0]?.id;
			if (!activeTabId) throw new Error("No active tab");

			const metadata = await new Promise<DownloadItem[]>((resolve, reject) => {
				chrome.tabs.sendMessage(
					activeTabId,
					{ type: "GET_METADATA" },
					(resp: unknown) => {
						if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
						else resolve(downloadItemSchema.array().parse(resp ?? []));
					},
				);
			});

			if (!metadata || metadata.length === 0) {
				setUploadStatus("No media found.");
				return;
			}

			setUploadStatus(`Uploading ${metadata.length} items...`);
			const client = await getClient();
			const result = (await client.imports.bulkAdd({ items: metadata })) as {
				addedCount: number;
				skippedCount: number;
			};
			setUploadStatus(
				`Uploaded! Added: ${result.addedCount}, Skipped: ${result.skippedCount}`,
			);
		} catch (_err) {
			setUploadStatus("Upload failed.");
		}
	};

	onMount(() => {
		void loadSettings().catch(() => {
			setStatus("Failed to load settings.");
			setStatusType("error");
		});
	});

	return (
		<div class="popup">
			<h2 class="popup-title">Settings</h2>

			<div class="popup-field">
				<label class="popup-label">
					API URL
					<input
						id="api-url"
						type="text"
						value={apiUrl()}
						onChange={(e) => {
							const url = e.currentTarget.value;
							setApiUrl(url);
							void chrome.storage.local
								.set({ apiUrl: url })
								.then(() => fetchSources())
								.catch(() => {
									setStatus("Failed to save API URL.");
									setStatusType("error");
								});
						}}
						class="popup-control"
					/>
				</label>
			</div>

			<div class="popup-field">
				<label class="popup-label">
					Target Media Source
					<select
						id="source-select"
						ref={(el) => (selectRef = el)}
						value={selectedSourceId()}
						onChange={(e) => {
							const id = e.currentTarget.value;
							setSelectedSourceId(id);
							void chrome.storage.local
								.set({ selectedSourceId: id })
								.catch(() => {
									setStatus("Failed to save source selection.");
									setStatusType("error");
								});
						}}
						disabled={isLoading() || sources().length === 0}
						class="popup-control"
					>
						<Show when={sources().length === 0}>
							<option value="">No sources found</option>
						</Show>
						<For each={sources()}>
							{(source) => (
								<option value={source.id}>
									{source.name} ({source.type})
								</option>
							)}
						</For>
					</select>
				</label>
			</div>

			<div
				class="popup-status"
				classList={{
					"popup-status-error": statusType() === "error",
					"popup-status-success": statusType() === "success",
				}}
			>
				{status()}
			</div>

			<hr class="popup-divider" />

			<button
				type="button"
				onClick={() => {
					void handleExport();
				}}
				class="popup-button popup-button-export"
			>
				Export Collected JSON
			</button>
			<div class="popup-result">{exportStatus()}</div>

			<div class="popup-spacer"></div>

			<button
				type="button"
				onClick={() => {
					void handleBulkUpload();
				}}
				class="popup-button popup-button-upload"
			>
				Bulk Upload to Solid Imager
			</button>
			<div class="popup-result">{uploadStatus()}</div>
		</div>
	);
}

const root = document.getElementById("root");
if (root) render(() => <Popup />, root);
