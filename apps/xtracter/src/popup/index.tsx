import { getClient } from "@ext/api";
import type { MediaSource, TweetMetadata } from "@ext/schema";
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

	const loadSettings = async () => {
		const settings = await chrome.storage.local.get([
			"selectedSourceId",
			"apiUrl",
		]);
		if (settings.apiUrl) setApiUrl(settings.apiUrl);
		if (settings.selectedSourceId)
			setSelectedSourceId(settings.selectedSourceId);

		await fetchSources();
	};

	const fetchSources = async () => {
		setIsLoading(true);
		setStatus("Loading sources...");
		setStatusType("info");

		try {
			const resp: MediaSource[] = await chrome.runtime.sendMessage({
				type: "GET_SOURCES",
			});
			setSources(resp || []);
			if (resp && resp.length > 0 && !selectedSourceId()) {
				const firstId = resp[0].id;
				setSelectedSourceId(firstId);
				await chrome.storage.local.set({ selectedSourceId: firstId });
			}
			setStatus("");
		} catch (_err) {
			setStatus("Failed to load sources. Check API URL.");
			setStatusType("error");
		} finally {
			setIsLoading(false);
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

			const metadata = await new Promise<TweetMetadata[]>((resolve, reject) => {
				chrome.tabs.sendMessage(
					activeTabId,
					{ type: "GET_METADATA" },
					(resp) => {
						if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
						else resolve(resp || []);
					},
				);
			});

			if (!metadata || metadata.length === 0) {
				setUploadStatus("No media found.");
				return;
			}

			setUploadStatus(`Uploading ${metadata.length} items...`);
			const client = await getClient();
			const result = await client.imports.bulkAdd({ items: metadata });
			setUploadStatus(
				`Uploaded! Added: ${result.addedCount}, Skipped: ${result.skippedCount}`,
			);
		} catch (_err) {
			setUploadStatus("Upload failed.");
		}
	};

	onMount(loadSettings);

	return (
		<div
			style={{ width: "300px", padding: "16px", "font-family": "sans-serif" }}
		>
			<h2 style={{ "margin-top": "0", "font-size": "16px" }}>Settings</h2>

			<div style={{ "margin-bottom": "16px" }}>
				<label
					for="api-url"
					style={{
						display: "block",
						"margin-bottom": "8px",
						"font-size": "14px",
					}}
				>
					API URL
				</label>
				<input
					id="api-url"
					type="text"
					value={apiUrl()}
					onChange={async (e) => {
						const url = e.currentTarget.value;
						setApiUrl(url);
						await chrome.storage.local.set({ apiUrl: url });
						await fetchSources();
					}}
					style={{
						width: "100%",
						padding: "8px",
						border: "1px solid #ccc",
						"border-radius": "4px",
						"box-sizing": "border-box",
					}}
				/>
			</div>

			<div style={{ "margin-bottom": "16px" }}>
				<label
					for="source-select"
					style={{
						display: "block",
						"margin-bottom": "8px",
						"font-size": "14px",
					}}
				>
					Target Media Source
				</label>
				<select
					id="source-select"
					value={selectedSourceId()}
					onChange={async (e) => {
						const id = e.currentTarget.value;
						setSelectedSourceId(id);
						await chrome.storage.local.set({ selectedSourceId: id });
					}}
					disabled={isLoading() || sources().length === 0}
					style={{
						width: "100%",
						padding: "8px",
						border: "1px solid #ccc",
						"border-radius": "4px",
					}}
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
			</div>

			<div
				style={{
					"margin-top": "8px",
					"font-size": "12px",
					"text-align": "center",
					color:
						statusType() === "error"
							? "red"
							: statusType() === "success"
								? "green"
								: "inherit",
				}}
			>
				{status()}
			</div>

			<hr
				style={{
					margin: "16px 0",
					border: "0",
					"border-top": "1px solid #eee",
				}}
			/>

			<button
				type="button"
				onClick={handleExport}
				style={{
					width: "100%",
					padding: "8px",
					"background-color": "#0f1419",
					color: "white",
					border: "none",
					"border-radius": "4px",
					cursor: "pointer",
					"margin-bottom": "4px",
				}}
			>
				Export Collected JSON
			</button>
			<div style={{ "font-size": "12px", "text-align": "center" }}>
				{exportStatus()}
			</div>

			<div style={{ height: "10px" }}></div>

			<button
				type="button"
				onClick={handleBulkUpload}
				style={{
					width: "100%",
					padding: "8px",
					"background-color": "#00ba7c",
					color: "white",
					border: "none",
					"border-radius": "4px",
					cursor: "pointer",
					"margin-bottom": "4px",
				}}
			>
				Bulk Upload to Solid Imager
			</button>
			<div style={{ "font-size": "12px", "text-align": "center" }}>
				{uploadStatus()}
			</div>
		</div>
	);
}

const root = document.getElementById("root");
if (root) render(() => <Popup />, root);
