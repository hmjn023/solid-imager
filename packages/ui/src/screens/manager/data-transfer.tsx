import { t } from "@solid-imager/i18n";
import Download from "lucide-solid/icons/download";
import Upload from "lucide-solid/icons/upload";
import { createSignal, onCleanup, Show } from "solid-js";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../../alert-dialog";
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
	const [exportPending, setExportPending] = createSignal(false);
	const [importPending, setImportPending] = createSignal(false);
	const [pendingRestoreFile, setPendingRestoreFile] = createSignal<{
		file: File;
		format: ManagerTransferFormat;
		sourceId: string;
		sourceName: string;
	} | null>(null);
	let fileInput: HTMLInputElement | undefined;
	let disposed = false;
	onCleanup(() => {
		disposed = true;
	});

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
		if (!selectedId || exportPending()) return;
		setExportPending(true);
		try {
			const exportJob = await props.actions.exportSource({
				format: exportFormat(),
				includeImages: includeImages(),
				sourceId: selectedId,
			});
			if (disposed) return;
			await props.actions.downloadExport(exportJob);
		} finally {
			if (!disposed) setExportPending(false);
		}
	};
	const importFile = async (target: {
		file: File;
		format: ManagerTransferFormat;
		sourceId: string;
	}) => {
		if (importPending()) return;
		setImportPending(true);
		try {
			await props.actions.importSource({
				file: target.file,
				format: target.format,
				sourceId: target.sourceId,
			});
		} finally {
			if (!disposed) {
				setImportPending(false);
				if (fileInput) fileInput.value = "";
			}
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
					disabled={exportPending() || importPending()}
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
				<Show when={!sourceId()}>
					<p class="text-xs text-muted-foreground">
						{t("dataTransfer.selectSourceHint")}
					</p>
				</Show>
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
								disabled={exportPending()}
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
								class="flex min-h-11 items-center gap-2 sm:min-h-9"
								disabled={exportPending()}
								onChange={setIncludeImages}
							>
								<CheckboxControl />
								<CheckboxLabel>
									{t("dataTransfer.includeOriginalMedia")}
								</CheckboxLabel>
							</Checkbox>
						</Show>
						<Button
							aria-busy={exportPending()}
							class="min-h-11 w-full sm:min-h-9 sm:w-auto"
							disabled={!sourceId() || exportPending()}
							onClick={() => void runExport()}
						>
							{exportPending()
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
								disabled={importPending()}
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
							disabled={!sourceId() || importPending()}
							onChange={(event) => {
								const file = event.currentTarget.files?.[0];
								const targetSource = selectedSource();
								event.currentTarget.value = "";
								if (file && targetSource?.id) {
									setPendingRestoreFile({
										file,
										format: importFormat(),
										sourceId: targetSource.id,
										sourceName: targetSource.name,
									});
								}
							}}
							ref={(element) => {
								fileInput = element;
							}}
							tabIndex={-1}
							type="file"
						/>
						<Button
							aria-busy={importPending()}
							class="min-h-11 w-full sm:min-h-9 sm:w-auto"
							disabled={!sourceId() || importPending()}
							onClick={() => fileInput?.click()}
							variant="outline"
						>
							{importPending()
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

			<AlertDialog
				open={Boolean(pendingRestoreFile())}
				onOpenChange={(open) => {
					if (!open) setPendingRestoreFile(null);
				}}
			>
				<AlertDialogContent class="workspace-theme rounded-lg sm:max-w-dialog-xs">
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("dataTransfer.confirmRestoreTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription class="break-words">
							<Show when={pendingRestoreFile()}>
								{(pending) =>
									t("dataTransfer.confirmRestoreDescription", {
										file: pending().file.name,
										format: formatOptionLabel(pending().format),
										source: pending().sourceName,
									})
								}
							</Show>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel class="min-h-11 sm:min-h-9">
							{t("actions.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							class="min-h-11 sm:min-h-9"
							onClick={() => {
								const target = pendingRestoreFile();
								setPendingRestoreFile(null);
								if (target) {
									void importFile(target);
								}
							}}
						>
							{t("dataTransfer.confirmRestoreAction")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
