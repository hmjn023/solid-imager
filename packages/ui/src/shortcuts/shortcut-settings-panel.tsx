import {
	createHotkeyRecorder,
	formatForDisplay,
	type Hotkey,
} from "@tanstack/solid-hotkeys";
import {
	createSignal,
	createUniqueId,
	For,
	type JSX,
	onCleanup,
} from "solid-js";

import { Button } from "../button";
import { Input } from "../input";
import { cn } from "../utils/cn";
import {
	getShortcutDefinition,
	getShortcutDefinitionsForGroup,
	SHORTCUT_GROUPS,
	type ShortcutBinding,
	type ShortcutDefinition,
	type ShortcutId,
} from "./definitions";
import {
	type ShortcutBindingUpdateResult,
	useOptionalShortcutPreferences,
	useShortcutPreferences,
} from "./preferences-provider";
import { createShortcutDisplayPlatform } from "./shortcut-kbd";

export interface ShortcutSettingsPanelProps {
	readonly class?: string;
	readonly title?: string;
	readonly description?: string;
}

type FeedbackTone = "info" | "success" | "error";

interface ShortcutFeedback {
	readonly shortcutId: ShortcutId | null;
	readonly message: string;
	readonly tone: FeedbackTone;
}

export function ShortcutSettingsPanel(
	props: ShortcutSettingsPanelProps,
): JSX.Element {
	const optionalPreferences = useOptionalShortcutPreferences();
	const preferences = useShortcutPreferences();
	const platform = createShortcutDisplayPlatform();
	const idPrefix = createUniqueId();
	const headingId = `${idPrefix}-heading`;
	const statusId = `${idPrefix}-status`;
	const [activeShortcutId, setActiveShortcutId] =
		createSignal<ShortcutId | null>(null);
	const [feedback, setFeedback] = createSignal<ShortcutFeedback | null>(null);

	const finishRecording = (): void => {
		setActiveShortcutId(null);
		preferences.setRecordingShortcutId(null);
	};

	const describeUpdateResult = (
		id: ShortcutId,
		result: ShortcutBindingUpdateResult,
	): void => {
		const definition = getShortcutDefinition(id);
		if (result.status === "conflict") {
			const displayBinding = formatForDisplay(result.conflict.binding, {
				platform: platform(),
			});
			setFeedback({
				shortcutId: id,
				tone: "error",
				message: `Conflict: ${displayBinding} is already assigned to ${result.conflict.label}. The shortcut was not saved.`,
			});
			return;
		}

		if (result.status === "invalid") {
			setFeedback({
				shortcutId: id,
				tone: "error",
				message: `Invalid shortcut: ${result.messages.join(" ")}`,
			});
			return;
		}

		if (result.status === "unavailable") {
			setFeedback({
				shortcutId: id,
				tone: "error",
				message:
					"Shortcut preferences are unavailable because the settings provider is not mounted.",
			});
			return;
		}

		setFeedback({
			shortcutId: id,
			tone: "success",
			message:
				result.binding === null
					? `${definition.label} is disabled.`
					: `${definition.label} was updated for this device.`,
		});
	};

	const recorder = createHotkeyRecorder({
		ignoreInputs: false,
		onRecord: (hotkey: Hotkey) => {
			const id = activeShortcutId();
			if (id === null || hotkey.length === 0) {
				return;
			}

			describeUpdateResult(id, preferences.updateBinding(id, hotkey));
			finishRecording();
		},
		onClear: () => {
			const id = activeShortcutId();
			if (id === null) {
				return;
			}

			describeUpdateResult(id, preferences.updateBinding(id, null));
			finishRecording();
		},
		onCancel: () => {
			const id = activeShortcutId();
			if (id !== null) {
				setFeedback({
					shortcutId: id,
					tone: "info",
					message: `Recording for ${getShortcutDefinition(id).label} was cancelled.`,
				});
			}
			finishRecording();
		},
	});

	const startRecording = (id: ShortcutId): void => {
		if (optionalPreferences === undefined) {
			describeUpdateResult(id, { status: "unavailable" });
			return;
		}

		if (recorder.isRecording()) {
			recorder.cancelRecording();
		}

		setFeedback({
			shortcutId: id,
			tone: "info",
			message:
				"Recording. Press the new shortcut, Escape to cancel, or Backspace/Delete to disable it.",
		});
		setActiveShortcutId(id);
		preferences.setRecordingShortcutId(id);
		recorder.startRecording();
	};

	const toggleRecording = (id: ShortcutId): void => {
		if (activeShortcutId() === id && recorder.isRecording()) {
			recorder.cancelRecording();
			return;
		}
		startRecording(id);
	};

	const stopActiveRecording = (): void => {
		if (recorder.isRecording()) {
			recorder.stopRecording();
		}
		finishRecording();
	};

	const resetBinding = (id: ShortcutId): void => {
		stopActiveRecording();
		const result = preferences.resetBinding(id);
		if (result.status !== "updated") {
			describeUpdateResult(id, result);
			return;
		}
		setFeedback({
			shortcutId: id,
			tone: "success",
			message: `${getShortcutDefinition(id).label} was reset to its default.`,
		});
	};

	const resetAllBindings = (): void => {
		stopActiveRecording();
		preferences.resetAllBindings();
		setFeedback({
			shortcutId: null,
			tone: "success",
			message: "All keyboard shortcuts were reset to their defaults.",
		});
	};

	const displayBinding = (binding: ShortcutBinding): string =>
		binding === null
			? "Disabled"
			: formatForDisplay(binding, { platform: platform() });

	const isDefaultBinding = (definition: ShortcutDefinition): boolean =>
		preferences.getBinding(definition.id) === definition.defaultBinding;

	const inputId = (id: ShortcutId): string => `${idPrefix}-${id}-binding`;
	const descriptionId = (id: ShortcutId): string =>
		`${idPrefix}-${id}-description`;
	const describedBy = (id: ShortcutId): string =>
		feedback()?.shortcutId === id
			? `${descriptionId(id)} ${statusId}`
			: descriptionId(id);

	onCleanup(() => {
		recorder.stopRecording();
		if (activeShortcutId() !== null) {
			preferences.setRecordingShortcutId(null);
		}
	});

	return (
		<section
			aria-labelledby={headingId}
			class={cn(
				"rounded-lg border border-border bg-card text-card-foreground shadow-sm",
				props.class,
			)}
		>
			<header class="flex flex-wrap items-start justify-between gap-3 border-border border-b px-4 py-4">
				<div class="min-w-0 space-y-1">
					<h2 class="font-semibold text-base" id={headingId}>
						{props.title ?? "Keyboard shortcuts"}
					</h2>
					<p class="max-w-[80ch] text-muted-foreground text-sm">
						{props.description ??
							"Customize keyboard controls for this device. These preferences are stored locally."}
					</p>
				</div>
				<Button
					disabled={
						optionalPreferences === undefined ||
						!preferences.hasCustomBindings()
					}
					onClick={resetAllBindings}
					size="sm"
					type="button"
					variant="outline"
				>
					Reset all
				</Button>
				<p
					aria-atomic="true"
					class={cn(
						"basis-full text-sm",
						feedback()?.tone === "error" && "text-destructive",
						feedback()?.tone === "success" && "text-primary",
						feedback()?.tone === "info" && "text-muted-foreground",
					)}
					id={statusId}
					role="status"
				>
					{feedback()?.message ?? ""}
				</p>
			</header>

			<div class="divide-y divide-border">
				<For each={SHORTCUT_GROUPS}>
					{(group) => (
						<section aria-labelledby={`${idPrefix}-${group}-heading`}>
							<h3
								class="bg-muted px-4 py-2 font-medium text-muted-foreground text-xs"
								id={`${idPrefix}-${group}-heading`}
							>
								{group}
							</h3>
							{/* biome-ignore lint/a11y/noRedundantRoles: Tailwind removes list markers, so Safari needs the explicit list role. */}
							<ul class="divide-y divide-border" role="list">
								<For each={getShortcutDefinitionsForGroup(group)}>
									{(definition) => {
										const currentBinding = (): ShortcutBinding =>
											preferences.getBinding(definition.id);
										const isActive = (): boolean =>
											activeShortcutId() === definition.id &&
											recorder.isRecording();

										return (
											<li class="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
												<div class="min-w-0">
													<label
														class="font-medium text-sm"
														for={inputId(definition.id)}
													>
														{definition.label}
													</label>
													<p
														class="mt-0.5 max-w-[80ch] text-muted-foreground text-xs"
														id={descriptionId(definition.id)}
													>
														{definition.description}
													</p>
												</div>

												<div class="flex min-w-0 flex-wrap items-center gap-2 md:justify-end">
													<Input
														aria-describedby={describedBy(definition.id)}
														aria-invalid={
															feedback()?.shortcutId === definition.id &&
															feedback()?.tone === "error"
																? "true"
																: undefined
														}
														class={cn(
															"h-9 min-h-9 w-40 cursor-pointer select-none text-center font-mono text-xs",
															isActive() &&
																"border-primary ring-1 ring-primary",
														)}
														id={inputId(definition.id)}
														onClick={() => startRecording(definition.id)}
														onKeyDown={(event) => {
															if (
																!isActive() &&
																(event.key === "Enter" || event.key === " ")
															) {
																event.preventDefault();
																startRecording(definition.id);
															}
														}}
														readOnly
														value={
															isActive()
																? "Press shortcut…"
																: displayBinding(currentBinding())
														}
													/>
													<Button
														aria-describedby={descriptionId(definition.id)}
														aria-pressed={isActive()}
														onClick={() => toggleRecording(definition.id)}
														size="sm"
														type="button"
														variant={isActive() ? "secondary" : "outline"}
													>
														{isActive() ? "Cancel" : "Record"}
													</Button>
													<Button
														disabled={
															optionalPreferences === undefined ||
															isDefaultBinding(definition)
														}
														onClick={() => resetBinding(definition.id)}
														size="sm"
														type="button"
														variant="ghost"
													>
														Reset
													</Button>
												</div>
											</li>
										);
									}}
								</For>
							</ul>
						</section>
					)}
				</For>
			</div>
		</section>
	);
}
