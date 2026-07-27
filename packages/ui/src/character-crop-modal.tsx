import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import type {
	CreateManualMediaRegion,
	MaterializedMediaRegion,
	SafeMediaRegion,
	UpdateMediaRegion,
} from "@solid-imager/core/domain/media-regions/schemas";
import { createEffect, createSignal, For, on, Show } from "solid-js";
import { Button } from "./button";
import { refreshCharacterRegions } from "./character-crop-modal-state";
import { Checkbox, CheckboxControl, CheckboxLabel } from "./checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./dialog";
import { Input } from "./input";

export type CharacterCropModalProps = {
	isOpen: boolean;
	onClose: () => void;
	media: MediaDetails;
	loadRegions: (mediaId: string) => Promise<SafeMediaRegion[]>;
	detectRegions: (mediaId: string) => Promise<SafeMediaRegion[]>;
	createManualRegion: (
		input: CreateManualMediaRegion,
	) => Promise<SafeMediaRegion>;
	updateRegion: (input: UpdateMediaRegion) => Promise<SafeMediaRegion>;
	deleteRegion: (regionId: string, expectedRevision: string) => Promise<void>;
	materializeRegion: (
		regionId: string,
		expectedRevision: string,
		transparent: boolean,
	) => Promise<MaterializedMediaRegion>;
	getRenderUrl: (region: SafeMediaRegion, transparent: boolean) => string;
};

type RegionCardProps = {
	region: SafeMediaRegion;
	displayIndex: number;
	transparent: boolean;
	busy: boolean;
	getRenderUrl: CharacterCropModalProps["getRenderUrl"];
	onUpdate: CharacterCropModalProps["updateRegion"];
	onDelete: CharacterCropModalProps["deleteRegion"];
	onMaterialize: CharacterCropModalProps["materializeRegion"];
	onChanged: (region: SafeMediaRegion) => void;
	onDeleted: (regionId: string) => void;
	onAnnounce: (message: string) => void;
	onError: (message: string) => void;
	setBusy: (busy: boolean) => void;
};

class ModalOperationCancelledError extends Error {}

function isCancelled(error: unknown): boolean {
	return error instanceof ModalOperationCancelledError;
}

function parseCoordinate(value: string, name: string): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		throw new Error(`${name} must be a number.`);
	}
	return parsed;
}

function RegionCard(props: RegionCardProps) {
	const [editing, setEditing] = createSignal(false);
	const [confirmingDelete, setConfirmingDelete] = createSignal(false);
	const [label, setLabel] = createSignal(props.region.label ?? "");
	const [x, setX] = createSignal(String(props.region.x ?? 0));
	const [y, setY] = createSignal(String(props.region.y ?? 0));
	const [width, setWidth] = createSignal(String(props.region.width ?? 1));
	const [height, setHeight] = createSignal(String(props.region.height ?? 1));

	createEffect(
		on(
			() => props.region.regionRevision,
			() => {
				setLabel(props.region.label ?? "");
				setX(String(props.region.x ?? 0));
				setY(String(props.region.y ?? 0));
				setWidth(String(props.region.width ?? 1));
				setHeight(String(props.region.height ?? 1));
			},
		),
	);

	async function save(): Promise<void> {
		props.setBusy(true);
		props.onError("");
		try {
			const updated = await props.onUpdate({
				regionId: props.region.id,
				expectedRevision: props.region.regionRevision,
				bbox: {
					x: parseCoordinate(x(), "X"),
					y: parseCoordinate(y(), "Y"),
					width: parseCoordinate(width(), "Width"),
					height: parseCoordinate(height(), "Height"),
				},
				label: label().trim() || null,
			});
			props.onChanged(updated);
			setEditing(false);
			props.onAnnounce("Region updated.");
		} catch (error) {
			if (isCancelled(error)) return;
			props.onError(error instanceof Error ? error.message : "Update failed.");
		} finally {
			props.setBusy(false);
		}
	}

	async function remove(): Promise<void> {
		props.setBusy(true);
		props.onError("");
		try {
			await props.onDelete(props.region.id, props.region.regionRevision);
			props.onDeleted(props.region.id);
			props.onAnnounce("Region deleted. Materialized media was kept.");
		} catch (error) {
			if (isCancelled(error)) return;
			props.onError(error instanceof Error ? error.message : "Delete failed.");
		} finally {
			props.setBusy(false);
		}
	}

	async function materialize(): Promise<void> {
		props.setBusy(true);
		props.onError("");
		try {
			const result = await props.onMaterialize(
				props.region.id,
				props.region.regionRevision,
				props.transparent,
			);
			props.onAnnounce(
				result.alreadyExisted
					? `Existing derivative ${result.fileName} selected.`
					: `Created derivative ${result.fileName}.`,
			);
		} catch (error) {
			if (isCancelled(error)) return;
			props.onError(
				error instanceof Error ? error.message : "Materialization failed.",
			);
		} finally {
			props.setBusy(false);
		}
	}

	return (
		<article class="min-w-0 overflow-hidden rounded-lg border bg-card">
			<Show
				fallback={
					<div class="flex min-h-40 items-center justify-center bg-muted p-4 text-center text-muted-foreground text-sm">
						This region is stale. Detect it again before rendering.
					</div>
				}
				when={!props.region.stale}
			>
				<img
					alt={`Crop preview for ${props.region.label ?? "unlabelled region"}`}
					class="mx-auto block max-h-64 w-full object-contain"
					src={props.getRenderUrl(props.region, props.transparent)}
				/>
			</Show>
			<div class="space-y-3 p-3">
				<div class="flex min-w-0 flex-wrap items-center justify-between gap-2">
					<strong class="min-w-0 truncate text-sm">
						{props.region.label ?? "Unlabelled region"}
					</strong>
					<span class="rounded bg-muted px-2 py-1 text-xs">
						{props.region.kind === "person" ? "Detected" : "Manual"}
						{props.region.stale ? " · Stale" : ""}
					</span>
				</div>

				<Show
					fallback={
						<div class="space-y-3">
							<p class="text-muted-foreground text-xs">
								Position {(props.region.x ?? 0).toFixed(3)},{" "}
								{(props.region.y ?? 0).toFixed(3)} · Size{" "}
								{(props.region.width ?? 0).toFixed(3)} ×{" "}
								{(props.region.height ?? 0).toFixed(3)}
							</p>
							<div class="flex flex-wrap gap-2">
								<Button
									aria-label={`Edit ${props.region.label ?? "unlabelled"} region ${props.displayIndex}`}
									disabled={props.busy || props.region.stale}
									onClick={() => setEditing(true)}
									size="sm"
									type="button"
									variant="outline"
								>
									Edit
								</Button>
								<Button
									aria-label={`Materialize ${props.region.label ?? "unlabelled"} region ${props.displayIndex}`}
									disabled={props.busy || props.region.stale}
									onClick={materialize}
									size="sm"
									type="button"
									variant="secondary"
								>
									Materialize
								</Button>
								<Button
									aria-label={`Delete ${props.region.label ?? "unlabelled"} region ${props.displayIndex}`}
									disabled={props.busy}
									onClick={() => setConfirmingDelete(true)}
									size="sm"
									type="button"
									variant="ghost"
								>
									Delete
								</Button>
							</div>
							<Show when={confirmingDelete()}>
								<div class="rounded border border-destructive/40 p-3 text-sm">
									<p>
										Delete this region? Existing derivative media will remain.
									</p>
									<div class="mt-2 flex flex-wrap gap-2">
										<Button
											disabled={props.busy}
											onClick={remove}
											size="sm"
											type="button"
											variant="destructive"
										>
											Confirm delete
										</Button>
										<Button
											onClick={() => setConfirmingDelete(false)}
											size="sm"
											type="button"
											variant="outline"
										>
											Cancel
										</Button>
									</div>
								</div>
							</Show>
						</div>
					}
					when={editing()}
				>
					<div class="space-y-3">
						<label
							class="block text-sm"
							for={`region-${props.region.id}-label`}
						>
							Label
						</label>
						<Input
							id={`region-${props.region.id}-label`}
							onInput={(event) => setLabel(event.currentTarget.value)}
							value={label()}
						/>
						<div class="grid grid-cols-2 gap-2">
							<For
								each={[
									{ name: "X", value: x, set: setX },
									{ name: "Y", value: y, set: setY },
									{ name: "Width", value: width, set: setWidth },
									{ name: "Height", value: height, set: setHeight },
								]}
							>
								{(field) => {
									const inputId = `region-${props.region.id}-${field.name.toLowerCase()}`;
									return (
										<div>
											<label class="text-xs" for={inputId}>
												{field.name}
											</label>
											<Input
												id={inputId}
												max="1"
												min="0"
												onInput={(event) =>
													field.set(event.currentTarget.value)
												}
												step="0.001"
												type="number"
												value={field.value()}
											/>
										</div>
									);
								}}
							</For>
						</div>
						<div class="flex flex-wrap gap-2">
							<Button
								disabled={props.busy}
								onClick={save}
								size="sm"
								type="button"
							>
								Save
							</Button>
							<Button
								onClick={() => setEditing(false)}
								size="sm"
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
						</div>
					</div>
				</Show>
			</div>
		</article>
	);
}

export function CharacterCropModal(props: CharacterCropModalProps) {
	const [regions, setRegions] = createSignal<SafeMediaRegion[]>([]);
	const [isLoading, setIsLoading] = createSignal(false);
	const [busyRegionId, setBusyRegionId] = createSignal<string | null>(null);
	const [error, setError] = createSignal("");
	const [announcement, setAnnouncement] = createSignal("");
	const [transparent, setTransparent] = createSignal(false);
	const [showManualForm, setShowManualForm] = createSignal(false);
	const [manualLabel, setManualLabel] = createSignal("");
	const [manualX, setManualX] = createSignal("0");
	const [manualY, setManualY] = createSignal("0");
	const [manualWidth, setManualWidth] = createSignal("1");
	const [manualHeight, setManualHeight] = createSignal("1");
	let detectButton: HTMLButtonElement | undefined;
	let sessionToken = 0;

	function isCurrentSession(token: number, mediaId: string): boolean {
		return token === sessionToken && props.isOpen && props.media.id === mediaId;
	}

	async function guardCurrentSession<T>(promise: Promise<T>): Promise<T> {
		const token = sessionToken;
		const mediaId = props.media.id;
		const result = await promise;
		if (!isCurrentSession(token, mediaId)) {
			throw new ModalOperationCancelledError();
		}
		return result;
	}

	async function loadRegions(): Promise<void> {
		const token = sessionToken;
		const mediaId = props.media.id;
		setIsLoading(true);
		setError("");
		try {
			const result = await refreshCharacterRegions({
				mediaId,
				runDetection: false,
				loadRegions: props.loadRegions,
				detectRegions: props.detectRegions,
			});
			if (isCurrentSession(token, mediaId)) setRegions(result.regions);
		} catch (cause) {
			if (isCurrentSession(token, mediaId)) {
				setError(
					cause instanceof Error ? cause.message : "Unable to load regions.",
				);
			}
		} finally {
			if (isCurrentSession(token, mediaId)) setIsLoading(false);
		}
	}

	createEffect(
		on([() => props.isOpen, () => props.media.id], ([open]) => {
			sessionToken += 1;
			if (open) {
				void loadRegions();
				queueMicrotask(() => detectButton?.focus());
				return;
			}
			setRegions([]);
			setError("");
			setAnnouncement("");
			setIsLoading(false);
			setShowManualForm(false);
		}),
	);

	async function detect(): Promise<void> {
		const token = sessionToken;
		const mediaId = props.media.id;
		setIsLoading(true);
		setError("");
		setAnnouncement("");
		try {
			const result = await refreshCharacterRegions({
				mediaId,
				runDetection: true,
				loadRegions: props.loadRegions,
				detectRegions: props.detectRegions,
			});
			if (!isCurrentSession(token, mediaId)) return;
			setRegions(result.regions);
			setAnnouncement(
				result.detectionCount === 0
					? "Detection completed. No people were found."
					: `Detection completed. Saved ${result.detectionCount ?? 0} regions.`,
			);
		} catch (cause) {
			if (isCurrentSession(token, mediaId)) {
				setError(cause instanceof Error ? cause.message : "Detection failed.");
			}
		} finally {
			if (isCurrentSession(token, mediaId)) setIsLoading(false);
		}
	}

	async function createManual(): Promise<void> {
		const token = sessionToken;
		const mediaId = props.media.id;
		setIsLoading(true);
		setError("");
		try {
			const created = await props.createManualRegion({
				mediaId,
				bbox: {
					x: parseCoordinate(manualX(), "X"),
					y: parseCoordinate(manualY(), "Y"),
					width: parseCoordinate(manualWidth(), "Width"),
					height: parseCoordinate(manualHeight(), "Height"),
				},
				label: manualLabel().trim() || null,
			});
			if (!isCurrentSession(token, mediaId)) return;
			setRegions((current) => [...current, created]);
			setShowManualForm(false);
			setAnnouncement("Manual region created.");
		} catch (cause) {
			if (isCurrentSession(token, mediaId)) {
				setError(cause instanceof Error ? cause.message : "Creation failed.");
			}
		} finally {
			if (isCurrentSession(token, mediaId)) setIsLoading(false);
		}
	}

	return (
		<Dialog
			onOpenChange={(open) => !open && props.onClose()}
			open={props.isOpen}
		>
			<DialogContent class="min-w-0 overflow-x-hidden sm:max-w-[900px]">
				<DialogHeader>
					<DialogTitle class="flex items-center gap-2">
						<span aria-hidden="true" class="i-lucide-scan text-indigo-600" />
						Character regions
					</DialogTitle>
					<DialogDescription>
						Review saved regions, run detection explicitly, or create a manual
						crop. Crop binaries are rendered on demand.
					</DialogDescription>
				</DialogHeader>

				<div class="flex flex-wrap items-center gap-2">
					<Button
						disabled={isLoading()}
						onClick={detect}
						ref={detectButton}
						type="button"
					>
						{regions().length > 0 ? "Re-detect people" : "Detect people"}
					</Button>
					<Button
						disabled={isLoading()}
						onClick={() => setShowManualForm((current) => !current)}
						type="button"
						variant="outline"
					>
						{showManualForm() ? "Cancel manual region" : "Add manual region"}
					</Button>
					<Checkbox checked={transparent()} onChange={setTransparent}>
						<CheckboxControl class="h-4 w-4 rounded border-gray-300 bg-white text-primary shadow-sm" />
						<CheckboxLabel class="cursor-pointer text-sm">
							Transparent render (slower)
						</CheckboxLabel>
					</Checkbox>
				</div>

				<Show when={showManualForm()}>
					<fieldset class="space-y-3 rounded-lg border p-4">
						<legend class="px-1 font-medium text-sm">
							Manual normalized bounds
						</legend>
						<label class="block text-sm" for="manual-region-label">
							Label
						</label>
						<Input
							id="manual-region-label"
							onInput={(event) => setManualLabel(event.currentTarget.value)}
							value={manualLabel()}
						/>
						<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
							<For
								each={[
									{ name: "X", value: manualX, set: setManualX },
									{ name: "Y", value: manualY, set: setManualY },
									{ name: "Width", value: manualWidth, set: setManualWidth },
									{ name: "Height", value: manualHeight, set: setManualHeight },
								]}
							>
								{(field) => {
									const inputId = `manual-region-${field.name.toLowerCase()}`;
									return (
										<div>
											<label class="text-xs" for={inputId}>
												{field.name}
											</label>
											<Input
												id={inputId}
												max="1"
												min="0"
												onInput={(event) =>
													field.set(event.currentTarget.value)
												}
												step="0.001"
												type="number"
												value={field.value()}
											/>
										</div>
									);
								}}
							</For>
						</div>
						<Button disabled={isLoading()} onClick={createManual} type="button">
							Create region
						</Button>
					</fieldset>
				</Show>

				<div
					aria-atomic="true"
					aria-live="polite"
					class="min-h-5 text-sm"
					role="status"
				>
					<Show when={error()}>
						<span class="text-destructive">{error()}</span>
					</Show>
					<Show when={!error() && announcement()}>
						<span>{announcement()}</span>
					</Show>
					<Show when={isLoading()}>
						<span>Working…</span>
					</Show>
				</div>

				<Show
					fallback={
						<p class="py-8 text-center text-muted-foreground">
							No saved character regions yet. Detection runs only when you press
							the button above.
						</p>
					}
					when={regions().length > 0}
				>
					<div
						aria-busy={isLoading()}
						class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
					>
						<For each={regions()}>
							{(region, index) => (
								<RegionCard
									displayIndex={index() + 1}
									busy={busyRegionId() === region.id}
									getRenderUrl={props.getRenderUrl}
									onAnnounce={setAnnouncement}
									onChanged={(changed) =>
										setRegions((current) =>
											current.map((item) =>
												item.id === changed.id ? changed : item,
											),
										)
									}
									onDelete={(regionId, expectedRevision) =>
										guardCurrentSession(
											props.deleteRegion(regionId, expectedRevision),
										)
									}
									onDeleted={(regionId) =>
										setRegions((current) =>
											current.filter((item) => item.id !== regionId),
										)
									}
									onError={setError}
									onMaterialize={(regionId, expectedRevision, transparent) =>
										guardCurrentSession(
											props.materializeRegion(
												regionId,
												expectedRevision,
												transparent,
											),
										)
									}
									onUpdate={(input) =>
										guardCurrentSession(props.updateRegion(input))
									}
									region={region}
									setBusy={(busy) => setBusyRegionId(busy ? region.id : null)}
									transparent={transparent()}
								/>
							)}
						</For>
					</div>
				</Show>
			</DialogContent>
		</Dialog>
	);
}
