import type {
	MediaTaskKind,
	ProcessingRecoveryReason,
} from "@solid-imager/core/domain/processing/schemas";
import { processingRecoveryReasonSchema } from "@solid-imager/core/domain/processing/schemas";
import { createQuery } from "@tanstack/solid-query";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { isServer } from "solid-js/web";
import { Button } from "../button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../select";
import {
	emptyRecoveryProgress,
	runProcessingRecovery,
	type ProcessingRecoveryApi,
} from "./processing-recovery";

const reasonLabels: Record<ProcessingRecoveryReason, string> = {
	not_requested: "Not requested",
	failed: "Failed",
	outdated: "Outdated",
	missing_output: "Missing output",
	abandoned: "Abandoned",
};
const kinds: MediaTaskKind[] = ["metadata", "thumbnail", "tagging", "ccip"];
export function ProcessingRecoveryPanel(props: {
	api: ProcessingRecoveryApi;
	labels: Record<MediaTaskKind, string>;
	query: () => string;
	onBusyChange: (busy: boolean) => void;
	onQueued: () => Promise<void>;
}) {
	const sources = createQuery(() => ({
		queryKey: ["processing-recovery", "sources"],
		queryFn: () => props.api.listSources(),
		enabled: !isServer,
		staleTime: 30_000,
	}));
	const [kind, setKind] = createSignal<MediaTaskKind>("metadata");
	const [source, setSource] = createSignal("all");
	const [busy, setBusy] = createSignal<"scan" | "queue" | null>(null);
	const [progress, setProgress] = createSignal(emptyRecoveryProgress());
	const [scanned, setScanned] = createSignal(false);
	const [message, setMessage] = createSignal("");
	let controller: AbortController | undefined;
	onCleanup(() => controller?.abort());
	createEffect(() => {
		kind();
		source();
		props.query();
		setScanned(false);
		setProgress(emptyRecoveryProgress());
		setMessage("");
	});
	const sourceName = (id: string) =>
		id === "all"
			? "All local sources"
			: (sources.data?.find((source) => source.id === id)?.name ?? id);
	const run = async (mode: "scan" | "queue") => {
		if (busy() || (mode === "queue" && (!scanned() || !progress().matched)))
			return;
		controller = new AbortController();
		setBusy(mode);
		props.onBusyChange(true);
		setScanned(false);
		setProgress(emptyRecoveryProgress());
		setMessage("");
		try {
			const result = await runProcessingRecovery(
				(input, signal) =>
					mode === "scan"
						? props.api.scanRecovery(input, signal)
						: props.api.enqueueRecovery(input, signal),
				{
					kind: kind(),
					mediaSourceId: source() === "all" ? undefined : source(),
					query: props.query(),
				},
				controller.signal,
				setProgress,
			);
			setScanned(mode === "scan");
			setMessage(
				mode === "scan"
					? `Scan complete: ${result.matched} unfinished steps found.`
					: `${result.queued} steps queued in ${result.batches} batches. Follow them in Job history.`,
			);
		} catch (error) {
			setMessage(
				controller.signal.aborted
					? "Stopped. Batches already queued remain in Job history."
					: `Stopped after checking ${progress().scanned} media and queuing ${progress().queued} steps: ${error instanceof Error ? error.message : "Connection failed"}. Scan again to continue.`,
			);
		} finally {
			if (mode === "queue")
				await props
					.onQueued()
					.catch(() =>
						setMessage(
							(message) =>
								`${message} Could not refresh the list; use Refresh processing.`,
						),
					);
			setBusy(null);
			props.onBusyChange(false);
		}
	};
	return (
		<section
			aria-label="Recover unfinished processing"
			class="mb-4 space-y-3 rounded-md border border-border bg-card p-3"
		>
			<h2 class="font-semibold text-sm">Recover unfinished processing</h2>
			<p class="text-xs leading-5 text-muted-foreground">
				未要求・失敗・古い要求・成果物の欠損を検査します。正常な完了済みと投入・実行中は保持します。ファイル名の検索条件も適用されます。
			</p>
			<div class="flex flex-wrap items-center gap-2">
				<Select<MediaTaskKind>
					options={kinds}
					value={kind()}
					onChange={(value) => {
						if (value) setKind(value);
					}}
					itemComponent={(item) => (
						<SelectItem item={item.item}>
							{props.labels[item.item.rawValue]}
						</SelectItem>
					)}
				>
					<SelectTrigger
						aria-label="Recovery step"
						class="w-full sm:w-44"
						disabled={!!busy()}
					>
						<SelectValue<MediaTaskKind>>
							{(state) => props.labels[state.selectedOption() ?? "metadata"]}
						</SelectValue>
					</SelectTrigger>
					<SelectContent />
				</Select>
				<Select<string>
					options={[
						"all",
						...(sources.data ?? []).flatMap((source) =>
							source.type === "local" && source.id ? [source.id] : [],
						),
					]}
					value={source()}
					onChange={(value) => {
						if (value) setSource(value);
					}}
					itemComponent={(item) => (
						<SelectItem item={item.item}>
							{sourceName(item.item.rawValue)}
						</SelectItem>
					)}
				>
					<SelectTrigger
						aria-label="Recovery source"
						class="w-full sm:w-52"
						disabled={!!busy()}
					>
						<SelectValue<string>>
							{(state) => sourceName(state.selectedOption() ?? "all")}
						</SelectValue>
					</SelectTrigger>
					<SelectContent />
				</Select>
				<Button
					variant="outline"
					size="sm"
					disabled={!!busy()}
					aria-busy={busy() === "scan"}
					onClick={() => void run("scan")}
				>
					Find unfinished
				</Button>
				<Button
					size="sm"
					disabled={!!busy() || !scanned() || !progress().matched}
					aria-busy={busy() === "queue"}
					onClick={() => void run("queue")}
				>
					Queue unfinished
				</Button>
				<Show when={busy()}>
					<Button
						variant="outline"
						size="sm"
						onClick={() => controller?.abort()}
					>
						Stop recovery
					</Button>
				</Show>
			</div>
			<Show when={sources.error}>
				<p class="text-xs text-destructive">
					Could not load sources.{" "}
					<Button
						variant="ghost"
						size="sm"
						onClick={() => void sources.refetch()}
					>
						Reload recovery sources
					</Button>
				</p>
			</Show>
			<output
				aria-live="polite"
				class="block space-y-1 text-xs text-muted-foreground"
			>
				<span class="block">
					{progress().scanned} checked · {progress().matched} unfinished ·{" "}
					{progress().queued} queued
				</span>
				<span class="block">{message()}</span>
				<For each={processingRecoveryReasonSchema.options}>
					{(reason) => (
						<Show when={progress().reasons[reason] > 0}>
							<span class="mr-3">
								{reasonLabels[reason]}: {progress().reasons[reason]}
							</span>
						</Show>
					)}
				</For>
			</output>
			<Show when={progress().samples.length}>
				<details class="text-xs text-muted-foreground">
					<summary>Examples (up to 10)</summary>
					<ul class="mt-2 space-y-1">
						<For each={progress().samples}>
							{(item) => (
								<li>
									{item.fileName} · {item.sourceName} ·{" "}
									{reasonLabels[item.reason]}
								</li>
							)}
						</For>
					</ul>
				</details>
			</Show>
		</section>
	);
}
