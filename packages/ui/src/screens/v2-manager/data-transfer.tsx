import Download from "lucide-solid/icons/download";
import Upload from "lucide-solid/icons/upload";
import { createSignal, Show } from "solid-js";
import { Button } from "../../button";
import { Checkbox, CheckboxControl, CheckboxLabel } from "../../checkbox";
import type { UseManagerPageResult } from "../../hooks/use-manager-page";
import { Input } from "../../input";
import { Label } from "../../label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../select";
import type {
	V2ManagerTransferActions,
	V2ManagerTransferFormat,
} from "./types";

export function DataTransferPanel(props: {
	actions: V2ManagerTransferActions;
	manager: UseManagerPageResult;
}) {
	const [sourceId, setSourceId] = createSignal<string>();
	const [exportFormat, setExportFormat] =
		createSignal<V2ManagerTransferFormat>("ndjson");
	const [importFormat, setImportFormat] =
		createSignal<V2ManagerTransferFormat>("ndjson");
	const [includeImages, setIncludeImages] = createSignal(false);
	const [pending, setPending] = createSignal<"export" | "import" | null>(null);
	let fileInput: HTMLInputElement | undefined;

	const selectedSource = () =>
		props.manager.sources().find((source) => source.id === sourceId());
	const accept = () => {
		switch (importFormat()) {
			case "ndjson":
				return ".ndjson,application/x-ndjson";
			case "tar":
				return ".tar,.zip,application/x-tar,application/zip";
			case "lancedb":
				return ".tar,application/x-tar";
		}
	};
	const runExport = async () => {
		const selectedId = sourceId();
		if (!selectedId || pending()) return;
		setPending("export");
		try {
			await props.actions.exportSource({
				format: exportFormat(),
				includeImages: includeImages(),
				sourceId: selectedId,
			});
		} finally {
			setPending(null);
		}
	};
	const importFile = async (file: File) => {
		const selectedId = sourceId();
		if (!selectedId || pending()) return;
		setPending("import");
		try {
			await props.actions.importSource({
				file,
				format: importFormat(),
				sourceId: selectedId,
			});
		} finally {
			setPending(null);
			if (fileInput) fileInput.value = "";
		}
	};

	return (
		<div class="space-y-5">
			<div>
				<h2 class="font-semibold text-lg text-[var(--v2-text)]">
					Data transfer
				</h2>
				<p class="mt-0.5 text-xs text-[var(--v2-text-muted)]">
					Export a portable source dump or restore one into an existing source.
				</p>
			</div>

			<section class="space-y-1.5 border-[var(--v2-border)] border-y bg-[var(--v2-surface)] py-4 sm:rounded-md sm:border sm:p-4">
				<Label>Target source</Label>
				<Select
					itemComponent={(selectProps) => (
						<SelectItem item={selectProps.item}>
							{selectProps.item.rawValue.name}
						</SelectItem>
					)}
					onChange={(source) => setSourceId(source?.id)}
					options={props.manager.sources()}
					optionTextValue="name"
					optionValue="id"
					placeholder="Choose a source"
					value={selectedSource() ?? null}
				>
					<SelectTrigger class="w-full bg-[var(--v2-surface)] sm:max-w-xl">
						<SelectValue<unknown>>
							{() => selectedSource()?.name ?? "Choose a source"}
						</SelectValue>
					</SelectTrigger>
					<SelectContent />
				</Select>
				<p class="text-xs text-[var(--v2-text-muted)]">
					Restore writes into the selected source. Existing source configuration
					is not replaced.
				</p>
			</section>

			<div class="grid gap-4 xl:grid-cols-2">
				<section class="rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)] p-4">
					<div class="flex items-start gap-3">
						<span class="rounded-md bg-[var(--v2-surface-muted)] p-2 text-[var(--v2-primary)]">
							<Download aria-hidden="true" size={17} />
						</span>
						<div>
							<h3 class="font-medium text-sm text-[var(--v2-text)]">Export</h3>
							<p class="mt-0.5 text-xs text-[var(--v2-text-muted)]">
								Download metadata, media archive, or LanceDB data.
							</p>
						</div>
					</div>
					<div class="mt-4 space-y-4">
						<div class="space-y-1.5">
							<Label>Format</Label>
							<Select
								onChange={(value) => value && setExportFormat(value)}
								options={["ndjson", "tar", "lancedb"] as const}
								value={exportFormat()}
							>
								<SelectTrigger class="w-full">
									<SelectValue<string>>
										{(state) =>
											state.selectedOption() === "ndjson"
												? "NDJSON metadata"
												: state.selectedOption() === "tar"
													? "TAR archive"
													: "LanceDB TAR"
										}
									</SelectValue>
								</SelectTrigger>
								<SelectContent />
							</Select>
						</div>
						<Show when={exportFormat() === "lancedb"}>
							<Checkbox
								checked={includeImages()}
								class="flex min-h-9 items-center gap-2"
								onChange={setIncludeImages}
							>
								<CheckboxControl />
								<CheckboxLabel>Include original media</CheckboxLabel>
							</Checkbox>
						</Show>
						<Button
							class="w-full sm:w-auto"
							disabled={!sourceId() || pending() !== null}
							onClick={() => void runExport()}
						>
							{pending() === "export" ? "Queueing..." : "Queue export"}
						</Button>
					</div>
				</section>

				<section class="rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)] p-4">
					<div class="flex items-start gap-3">
						<span class="rounded-md bg-[var(--v2-surface-muted)] p-2 text-[var(--v2-primary)]">
							<Upload aria-hidden="true" size={17} />
						</span>
						<div>
							<h3 class="font-medium text-sm text-[var(--v2-text)]">Restore</h3>
							<p class="mt-0.5 text-xs text-[var(--v2-text-muted)]">
								Choose the dump type before selecting its file.
							</p>
						</div>
					</div>
					<div class="mt-4 space-y-4">
						<div class="space-y-1.5">
							<Label>Format</Label>
							<Select
								onChange={(value) => value && setImportFormat(value)}
								options={["ndjson", "tar", "lancedb"] as const}
								value={importFormat()}
							>
								<SelectTrigger class="w-full">
									<SelectValue<string>>
										{(state) =>
											state.selectedOption() === "ndjson"
												? "NDJSON metadata"
												: state.selectedOption() === "tar"
													? "TAR archive"
													: "LanceDB TAR"
										}
									</SelectValue>
								</SelectTrigger>
								<SelectContent />
							</Select>
						</div>
						<Input
							accept={accept()}
							aria-label="復元するダンプファイル"
							class="sr-only"
							onChange={(event) => {
								const file = event.currentTarget.files?.[0];
								if (file) void importFile(file);
							}}
							ref={fileInput}
							type="file"
						/>
						<Button
							class="w-full sm:w-auto"
							disabled={!sourceId() || pending() !== null}
							onClick={() => fileInput?.click()}
							variant="outline"
						>
							{pending() === "import" ? "Queueing..." : "Choose dump file"}
						</Button>
					</div>
				</section>
			</div>
			<p class="text-xs text-[var(--v2-text-muted)]">
				Transfers are queued as background jobs. Open Jobs to monitor, cancel,
				or download completed exports.
			</p>
		</div>
	);
}
