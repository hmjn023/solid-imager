import { t } from "@solid-imager/i18n";
import Download from "lucide-solid/icons/download";
import Upload from "lucide-solid/icons/upload";
import { createSignal, Show } from "solid-js";
import { Button } from "../../button";
import { Checkbox, CheckboxControl, CheckboxLabel } from "../../checkbox";
import type { UseManagerPageResult } from "../../hooks/use-manager-page";
import { Input } from "../../input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../../select";
import type { ManagerTransferActions, ManagerTransferFormat } from "./types";

function formatOptionLabel(format: ManagerTransferFormat): string {
	return format === "ndjson"
		? t("dataTransfer.nDJSONMetadata")
		: t("dataTransfer.tARArchive");
}

export function DataTransferPanel(props: {
	actions: ManagerTransferActions;
	manager: UseManagerPageResult;
}) {
	const [sourceId, setSourceId] = createSignal<string>();
	const [exportFormat, setExportFormat] =
		createSignal<ManagerTransferFormat>("ndjson");
	const [importFormat, setImportFormat] =
		createSignal<ManagerTransferFormat>("ndjson");
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
				return ".tar,application/x-tar,application/tar";
		}
	};
	const runExport = async () => {
		const selectedId = sourceId();
		if (!selectedId || pending()) return;
		setPending("export");
		try {
			const exportJob = await props.actions.exportSource({
				format: exportFormat(),
				includeImages: includeImages(),
				sourceId: selectedId,
			});
			await props.actions.downloadExport(exportJob);
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
				<h2 class="font-semibold text-lg text-foreground">
					{t("types.dataTransfer")}
				</h2>
				<p class="mt-0.5 text-xs text-muted-foreground">
					{t("dataTransfer.exportAPortableSourceDumpOrRestoreOneInto")}
				</p>
			</div>

			<section class="space-y-1.5 border-border border-y bg-card py-4 sm:rounded-md sm:border sm:p-4">
				<Select
					class="space-y-1.5"
					itemComponent={(selectProps) => (
						<SelectItem item={selectProps.item}>
							{selectProps.item.rawValue.name}
						</SelectItem>
					)}
					onChange={(source) => setSourceId(source?.id)}
					options={props.manager.sources()}
					optionTextValue="name"
					optionValue="id"
					placeholder={t("dataTransfer.chooseASource")}
					value={selectedSource() ?? null}
				>
					<SelectLabel>{t("importReviewModal.targetSource")}</SelectLabel>
					<SelectTrigger class="w-full bg-card sm:max-w-xl">
						<SelectValue<unknown>>
							{() => selectedSource()?.name ?? t("dataTransfer.chooseASource")}
						</SelectValue>
					</SelectTrigger>
					<SelectContent />
				</Select>
				<p class="text-xs text-muted-foreground">
					{t(
						"dataTransfer.restoreWritesIntoTheSelectedSourceExistingSourceConfiguration",
					)}
				</p>
			</section>

			<div class="grid gap-4 xl:grid-cols-2">
				<section class="rounded-md border border-border bg-card p-4">
					<div class="flex items-start gap-3">
						<span class="rounded-md bg-muted p-2 text-primary">
							<Download aria-hidden="true" size={17} />
						</span>
						<div>
							<h3 class="font-medium text-sm text-foreground">
								{t("dataTransfer.export")}
							</h3>
							<p class="mt-0.5 text-xs text-muted-foreground">
								{t("dataTransfer.generateAndDownloadMetadataOrAMediaArchive")}
							</p>
						</div>
					</div>
					<div class="mt-4 space-y-4">
						<div class="space-y-1.5">
							<Select
								class="space-y-1.5"
								itemComponent={(selectProps) => (
									<SelectItem item={selectProps.item}>
										{formatOptionLabel(selectProps.item.rawValue)}
									</SelectItem>
								)}
								onChange={(value) => value && setExportFormat(value)}
								options={["ndjson", "tar"] as const}
								value={exportFormat()}
							>
								<SelectLabel>{t("dataTransfer.exportFormat")}</SelectLabel>
								<SelectTrigger class="w-full">
									<SelectValue<string>>
										{(state) =>
											state.selectedOption() === "ndjson"
												? t("dataTransfer.nDJSONMetadata")
												: state.selectedOption() === "tar"
													? t("dataTransfer.tARArchive")
													: t("dataTransfer.tARArchive")
										}
									</SelectValue>
								</SelectTrigger>
								<SelectContent />
							</Select>
						</div>
						<Show when={exportFormat() === "tar"}>
							<Checkbox
								checked={includeImages()}
								class="flex min-h-9 items-center gap-2"
								onChange={setIncludeImages}
							>
								<CheckboxControl />
								<CheckboxLabel>
									{t("dataTransfer.includeOriginalMedia")}
								</CheckboxLabel>
							</Checkbox>
						</Show>
						<Button
							class="w-full sm:w-auto"
							disabled={!sourceId() || pending() !== null}
							onClick={() => void runExport()}
						>
							{pending() === "export"
								? t("dataTransfer.generating")
								: t("dataTransfer.generateDownload")}
						</Button>
					</div>
				</section>

				<section class="rounded-md border border-border bg-card p-4">
					<div class="flex items-start gap-3">
						<span class="rounded-md bg-muted p-2 text-primary">
							<Upload aria-hidden="true" size={17} />
						</span>
						<div>
							<h3 class="font-medium text-sm text-foreground">
								{t("dataTransfer.restore")}
							</h3>
							<p class="mt-0.5 text-xs text-muted-foreground">
								{t("dataTransfer.chooseTheDumpTypeBeforeSelectingItsFile")}
							</p>
						</div>
					</div>
					<div class="mt-4 space-y-4">
						<div class="space-y-1.5">
							<Select
								class="space-y-1.5"
								itemComponent={(selectProps) => (
									<SelectItem item={selectProps.item}>
										{formatOptionLabel(selectProps.item.rawValue)}
									</SelectItem>
								)}
								onChange={(value) => value && setImportFormat(value)}
								options={["ndjson", "tar"] as const}
								value={importFormat()}
							>
								<SelectLabel>{t("dataTransfer.restoreFormat")}</SelectLabel>
								<SelectTrigger class="w-full">
									<SelectValue<string>>
										{(state) =>
											state.selectedOption() === "ndjson"
												? t("dataTransfer.nDJSONMetadata")
												: state.selectedOption() === "tar"
													? t("dataTransfer.tARArchive")
													: t("dataTransfer.tARArchive")
										}
									</SelectValue>
								</SelectTrigger>
								<SelectContent />
							</Select>
						</div>
						<Input
							accept={accept()}
							aria-label={t("dataTransfer.dumpFileToRestore")}
							class="sr-only"
							onChange={(event) => {
								const file = event.currentTarget.files?.[0];
								if (file) void importFile(file);
							}}
							ref={(element) => {
								fileInput = element;
							}}
							type="file"
						/>
						<Button
							class="w-full sm:w-auto"
							disabled={!sourceId() || pending() !== null}
							onClick={() => fileInput?.click()}
							variant="outline"
						>
							{pending() === "import"
								? t("dataTransfer.queueing")
								: t("dataTransfer.chooseDumpFile")}
						</Button>
					</div>
				</section>
			</div>
			<p class="text-xs text-muted-foreground">
				{t(
					"dataTransfer.exportsRunAsBackgroundJobsAndDownloadAutomaticallyWhen",
				)}
			</p>
		</div>
	);
}
