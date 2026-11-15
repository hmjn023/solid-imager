import {
	changeExtensionLocale,
	getExtensionLocale,
	initializeExtensionLocale,
	t,
} from "../i18n";
import { PixivConnection } from "./pixiv-connection";
import { DEFAULT_API_URL, getClient } from "@ext/api";
import {
	downloadItemSchema,
	type DownloadItem,
	type MediaSource,
	type ExtendedMessage,
	sourcesResponseSchema,
} from "@ext/schema";
import { createSignal, For, onMount, Show } from "solid-js";
import { render } from "solid-js/web";

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

	const [settingsGeneration, setSettingsGeneration] = createSignal(0);
	let fetchSeq = 0;

	const fetchSources = async (
		message: Extract<
			ExtendedMessage,
			{ type: "GET_SOURCES" | "SET_API_URL" | "SET_SOURCE" }
		> = { type: "GET_SOURCES" },
	) => {
		const seq = ++fetchSeq;
		setIsLoading(true);
		setSources([]);
		setSelectedSourceId("");
		setStatus(t("moveCopyMediaDialog.loadingSources"));
		setStatusType("info");
		try {
			const resp = sourcesResponseSchema.parse(
				await chrome.runtime.sendMessage(message),
			);
			if (seq !== fetchSeq) return;
			if (!resp.success) throw new Error(resp.error);
			setApiUrl(resp.apiUrl);
			setSettingsGeneration(resp.generation);
			setSources(resp.sources);
			setSelectedSourceId(resp.selectedSourceId ?? "");
			setStatus(
				resp.sources.length === 0 ? t("index.noSourcesFoundOnThisServer") : "",
			);
		} catch (error) {
			if (seq !== fetchSeq) return;
			setStatus(
				error instanceof Error
					? error.message
					: t("index.failedToLoadSourcesCheckAPIURL"),
			);
			setStatusType("error");
		} finally {
			if (seq === fetchSeq) setIsLoading(false);
		}
	};

	const handleExport = async () => {
		setExportStatus(t("index.requestingData"));
		try {
			await chrome.runtime.sendMessage({ type: "DOWNLOAD_JSON_FROM_POPUP" });
			setExportStatus(t("index.downloadStarted"));
			setTimeout(() => setExportStatus(""), 3000);
		} catch (_err) {
			setExportStatus(t("index.failedAreYouOnXCom"));
		}
	};

	const handleBulkUpload = async () => {
		setUploadStatus(t("index.fetchingMetadata"));
		try {
			const client = await getClient();
			const tabs = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});
			const activeTabId = tabs[0]?.id;
			if (!activeTabId) throw new Error(t("index.noActiveTab"));

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
				setUploadStatus(t("index.noMediaFound"));
				return;
			}

			setUploadStatus(
				t("index.uploadingValueItems", { value0: String(metadata.length) }),
			);
			const result = (await client.imports.bulkAdd({ items: metadata })) as {
				addedCount: number;
				skippedCount: number;
			};
			setUploadStatus(
				t("index.uploadedAddedValueSkippedValue", {
					value0: String(result.addedCount),
					value1: String(result.skippedCount),
				}),
			);
		} catch (_err) {
			setUploadStatus(t("index.uploadFailed"));
		}
	};

	onMount(() => {
		void fetchSources().catch(() => {
			setStatus(t("index.failedToLoadSettings"));
			setStatusType("error");
		});
	});

	return (
		<div class="popup">
			<h2 class="popup-title">{t("navigation.settings")}</h2>
			<label>
				{t("locale.title")}
				<select
					value={getExtensionLocale()}
					onChange={(event) => {
						const locale = event.currentTarget.value;
						if (locale !== "ja" && locale !== "en") return;
						void changeExtensionLocale(locale).catch(() => {
							setStatus(t("locale.saveFailed"));
							setStatusType("error");
						});
					}}
				>
					<option lang="ja" value="ja">
						{t("locale.japanese")}
					</option>
					<option lang="en" value="en">
						{t("locale.english")}
					</option>
				</select>
			</label>

			<div class="popup-field">
				<label class="popup-label">
					{t("index.aPIURL")}
					<input
						id="api-url"
						type="text"
						value={apiUrl()}
						onChange={(e) => {
							const url = e.currentTarget.value;
							setApiUrl(url);
							void fetchSources({ type: "SET_API_URL", apiUrl: url });
						}}
						class="popup-control"
					/>
				</label>
			</div>

			<div class="popup-field">
				<label class="popup-label">
					{t("index.targetMediaSource")}
					<select
						id="source-select"
						value={selectedSourceId()}
						onChange={(e) => {
							const id = e.currentTarget.value;
							void fetchSources({
								type: "SET_SOURCE",
								apiUrl: apiUrl(),
								generation: settingsGeneration(),
								sourceId: id,
							});
						}}
						disabled={isLoading() || sources().length === 0}
						class="popup-control"
					>
						<Show when={sources().length === 0}>
							<option value="">{t("index.noSourcesFound")}</option>
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
			<PixivConnection apiUrl={apiUrl()} />
			<hr class="popup-divider" />

			<button
				type="button"
				onClick={() => {
					void handleExport();
				}}
				class="popup-button popup-button-export"
			>
				{t("index.exportCollectedJSON")}
			</button>
			<div class="popup-result">{exportStatus()}</div>

			<div class="popup-spacer"></div>

			<button
				type="button"
				onClick={() => {
					void handleBulkUpload();
				}}
				class="popup-button popup-button-upload"
				disabled={isLoading()}
			>
				{t("index.bulkUploadToSolidImager")}
			</button>
			<div class="popup-result">{uploadStatus()}</div>
		</div>
	);
}

const root = document.getElementById("root");
if (root)
	void initializeExtensionLocale().then((locale) => {
		document.documentElement.lang = locale;
		document.title = t("locale.extensionTitle");
		render(() => <Popup />, root);
	});
