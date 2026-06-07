import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import type { TaggingResponse } from "@solid-imager/core/domain/tagging/schemas";
import { Badge } from "@solid-imager/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@solid-imager/ui/dialog";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { fetchRustExperimentalTags } from "~/infrastructure/api-clients/ai-api";

type RustExperimentalModalProps = {
	isOpen: boolean;
	onClose: () => void;
	media: MediaDetails;
};

const PERCENTAGE_MULTIPLIER = 100;

interface ComparisonItem {
	name: string;
	dbScore: number | null; // null if not in DB
	rustScore: number | null; // null if not in Rust
	diff: number | null;
}

export default function RustExperimentalModal(
	props: RustExperimentalModalProps,
) {
	const [isLoading, setIsLoading] = createSignal(false);
	const [rustResult, setRustResult] = createSignal<TaggingResponse | null>(
		null,
	);
	const [error, setError] = createSignal<string | null>(null);

	createEffect(() => {
		if (props.isOpen) {
			analyzeWithRust();
		} else {
			setRustResult(null);
			setError(null);
			setIsLoading(false);
		}
	});

	const analyzeWithRust = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const data = await fetchRustExperimentalTags(props.media.id);
			setRustResult(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	// 1. General Tags Comparison Logic
	const tagsComparison = createMemo((): ComparisonItem[] => {
		const res = rustResult();
		if (!res) return [];

		const dbTagsMap = new Map<string, number | null>();
		for (const t of props.media.tags || []) {
			if (t.type === "positive") {
				dbTagsMap.set(t.name, t.confidence ?? null);
			}
		}

		const rustTagsMap = new Map<string, number>();
		for (const [name, score] of Object.entries(res.general)) {
			rustTagsMap.set(name, score);
		}

		const allNames = new Set([...dbTagsMap.keys(), ...rustTagsMap.keys()]);
		const comparison: ComparisonItem[] = [];

		for (const name of allNames) {
			const dbScore = dbTagsMap.has(name)
				? (dbTagsMap.get(name) ?? null)
				: null;
			const rustScore = rustTagsMap.has(name)
				? (rustTagsMap.get(name) ?? null)
				: null;
			let diff: number | null = null;
			if (dbScore !== null && rustScore !== null) {
				diff = rustScore - dbScore;
			}
			comparison.push({ name, dbScore, rustScore, diff });
		}

		return comparison.sort((a, b) => {
			const scoreA = a.rustScore ?? a.dbScore ?? 0;
			const scoreB = b.rustScore ?? b.dbScore ?? 0;
			return scoreB - scoreA;
		});
	});

	// 2. Characters Comparison Logic
	const charactersComparison = createMemo((): ComparisonItem[] => {
		const res = rustResult();
		if (!res) return [];

		const dbCharsMap = new Map<string, number | null>();
		for (const c of props.media.characters || []) {
			dbCharsMap.set(c.name, c.confidence ?? null);
		}

		const rustCharsMap = new Map<string, number>();
		for (const [name, score] of Object.entries(res.character)) {
			rustCharsMap.set(name, score);
		}

		const allNames = new Set([...dbCharsMap.keys(), ...rustCharsMap.keys()]);
		const comparison: ComparisonItem[] = [];

		for (const name of allNames) {
			const dbScore = dbCharsMap.has(name)
				? (dbCharsMap.get(name) ?? null)
				: null;
			const rustScore = rustCharsMap.has(name)
				? (rustCharsMap.get(name) ?? null)
				: null;
			let diff: number | null = null;
			if (dbScore !== null && rustScore !== null) {
				diff = rustScore - dbScore;
			}
			comparison.push({ name, dbScore, rustScore, diff });
		}

		return comparison.sort((a, b) => {
			const scoreA = a.rustScore ?? a.dbScore ?? 0;
			const scoreB = b.rustScore ?? b.dbScore ?? 0;
			return scoreB - scoreA;
		});
	});

	// 3. IPs Comparison Logic
	const ipsComparison = createMemo(() => {
		const res = rustResult();
		if (!res)
			return {
				dbOnly: [] as string[],
				rustOnly: [] as string[],
				both: [] as string[],
			};

		const dbIps = new Set((props.media.ips || []).map((ip) => ip.name));
		const rustIps = new Set(res.ips);

		const dbOnly = [...dbIps].filter((ip) => !rustIps.has(ip));
		const rustOnly = [...rustIps].filter((ip) => !dbIps.has(ip));
		const both = [...dbIps].filter((ip) => rustIps.has(ip));

		return { dbOnly, rustOnly, both };
	});

	return (
		<Dialog
			onOpenChange={(open) => !open && props.onClose()}
			open={props.isOpen}
		>
			<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
				<DialogHeader>
					<DialogTitle class="flex items-center gap-2">
						<span class="i-lucide-terminal text-indigo-600" />
						Rust Tagger Comparison (Experimental)
					</DialogTitle>
					<DialogDescription>
						Compare the results of the experimental Rust tagger
						(dghs-imgutils-rs) side-by-side with current DB tags (Python
						version). No changes will be persisted.
					</DialogDescription>
				</DialogHeader>

				<div class="py-4">
					<Show when={isLoading()}>
						<div class="flex flex-col items-center justify-center py-12">
							<div class="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
							<span class="mt-4 font-medium text-gray-600 text-sm">
								Running Rust ONNX Tagger inference...
							</span>
						</div>
					</Show>

					<Show when={error()}>
						<div class="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
							<h4 class="font-semibold">Inference Error</h4>
							<p class="mt-1 text-sm">{error()}</p>
						</div>
					</Show>

					<Show when={rustResult()}>
						<div class="space-y-8">
							{/* Characters Section */}
							<div>
								<h3 class="mb-3 font-semibold text-gray-800 text-lg border-b pb-1">
									Characters
								</h3>
								<Show
									fallback={
										<p class="text-gray-500 text-sm italic">
											No characters detected by either tagger.
										</p>
									}
									when={charactersComparison().length > 0}
								>
									<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
										<For each={charactersComparison()}>
											{(item) => (
												<div class="flex items-center justify-between rounded-lg border p-2.5 text-sm hover:bg-gray-50">
													<span class="font-medium text-gray-800">
														{item.name}
													</span>
													<div class="flex items-center gap-2">
														<Show
															fallback={
																<span class="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 text-xs font-semibold">
																	Rust Only
																</span>
															}
															when={item.dbScore !== null}
														>
															<span class="text-gray-500 text-xs">
																DB:{" "}
																{(
																	item.dbScore! * PERCENTAGE_MULTIPLIER
																).toFixed(0)}
																%
															</span>
														</Show>

														<Show
															fallback={
																<span class="rounded bg-rose-50 px-1.5 py-0.5 text-rose-700 text-xs font-semibold">
																	DB Only
																</span>
															}
															when={item.rustScore !== null}
														>
															<span class="rounded bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700 text-xs">
																Rust:{" "}
																{(
																	item.rustScore! * PERCENTAGE_MULTIPLIER
																).toFixed(0)}
																%
															</span>
														</Show>

														<Show when={item.diff !== null}>
															<span
																class={`text-xs font-bold ${
																	item.diff! >= 0
																		? "text-emerald-600"
																		: "text-rose-600"
																}`}
															>
																{item.diff! >= 0 ? "+" : ""}
																{(item.diff! * PERCENTAGE_MULTIPLIER).toFixed(
																	0,
																)}
																%
															</span>
														</Show>
													</div>
												</div>
											)}
										</For>
									</div>
								</Show>
							</div>

							{/* IPs / Series Section */}
							<div>
								<h3 class="mb-3 font-semibold text-gray-800 text-lg border-b pb-1">
									IPs (Copyright/Series)
								</h3>
								<div class="flex flex-wrap gap-2">
									<For each={ipsComparison().both}>
										{(ip) => (
											<Badge
												class="border-indigo-200 bg-indigo-50 text-indigo-800"
												variant="secondary"
											>
												{ip}
											</Badge>
										)}
									</For>
									<For each={ipsComparison().rustOnly}>
										{(ip) => (
											<Badge
												class="border-emerald-200 bg-emerald-50 text-emerald-800"
												variant="secondary"
											>
												{ip} (Rust Only)
											</Badge>
										)}
									</For>
									<For each={ipsComparison().dbOnly}>
										{(ip) => (
											<Badge
												class="border-rose-200 bg-rose-50 text-rose-800"
												variant="secondary"
											>
												{ip} (DB Only)
											</Badge>
										)}
									</For>
									<Show
										when={
											ipsComparison().both.length === 0 &&
											ipsComparison().rustOnly.length === 0 &&
											ipsComparison().dbOnly.length === 0
										}
									>
										<p class="text-gray-500 text-sm italic">
											No series IPs detected.
										</p>
									</Show>
								</div>
							</div>

							{/* General Tags Section */}
							<div>
								<h3 class="mb-3 font-semibold text-gray-800 text-lg border-b pb-1">
									General Tags
								</h3>
								<div class="overflow-x-auto rounded-lg border">
									<table class="w-full text-left border-collapse text-sm">
										<thead>
											<tr class="bg-gray-100 border-b">
												<th class="p-3 font-semibold text-gray-700">
													Tag Name
												</th>
												<th class="p-3 font-semibold text-gray-700 text-right">
													DB Score (Python)
												</th>
												<th class="p-3 font-semibold text-gray-700 text-right">
													Rust Score
												</th>
												<th class="p-3 font-semibold text-gray-700 text-right">
													Difference
												</th>
											</tr>
										</thead>
										<tbody>
											<For each={tagsComparison()}>
												{(item) => (
													<tr class="border-b hover:bg-gray-50/50">
														<td class="p-3 font-medium text-gray-900">
															{item.name}
														</td>
														<td class="p-3 text-right text-gray-600">
															{item.dbScore !== null ? (
																`${(item.dbScore * PERCENTAGE_MULTIPLIER).toFixed(1)}%`
															) : (
																<span class="text-emerald-600 font-semibold text-xs bg-emerald-50 px-1.5 py-0.5 rounded">
																	Rust New
																</span>
															)}
														</td>
														<td class="p-3 text-right text-gray-600">
															{item.rustScore !== null ? (
																`${(item.rustScore * PERCENTAGE_MULTIPLIER).toFixed(1)}%`
															) : (
																<span class="text-rose-600 font-semibold text-xs bg-rose-50 px-1.5 py-0.5 rounded">
																	Removed
																</span>
															)}
														</td>
														<td class="p-3 text-right">
															<Show
																fallback={
																	<span class="text-gray-400 text-xs">—</span>
																}
																when={item.diff !== null}
															>
																<span
																	class={`font-semibold ${
																		item.diff! >= 0
																			? "text-emerald-600"
																			: "text-rose-600"
																	}`}
																>
																	{item.diff! >= 0 ? "+" : ""}
																	{(item.diff! * PERCENTAGE_MULTIPLIER).toFixed(
																		1,
																	)}
																	%
																</span>
															</Show>
														</td>
													</tr>
												)}
											</For>
										</tbody>
									</table>
								</div>
							</div>
						</div>
					</Show>
				</div>
			</DialogContent>
		</Dialog>
	);
}
