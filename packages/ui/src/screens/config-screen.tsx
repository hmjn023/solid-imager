import { t } from "@solid-imager/i18n";
import {
	AppConfigSchema,
	AppConfigUpdateSchema,
	type AppConfig,
	type AppConfigUpdate,
	mcpConfigSchema,
	type McpToolInfo,
} from "@solid-imager/core/config";
import type { AiHealthResponse } from "@solid-imager/core/tagging";
import { createForm } from "../utils/create-form";
import { useQueryClient } from "@tanstack/solid-query";
// oxlint-disable-next-line typescript/no-deprecated -- TanStack Router's current Solid custom navigation-blocking API is exported under this deprecated annotation.
import { useBlocker } from "@tanstack/solid-router";
import Bot from "@lucide/solid/icons/bot";
import BriefcaseBusiness from "@lucide/solid/icons/briefcase-business";
import DownloadCloud from "@lucide/solid/icons/cloud-download";
import HardDrive from "@lucide/solid/icons/hard-drive";
import Image from "@lucide/solid/icons/image";
import Keyboard from "@lucide/solid/icons/keyboard";
import Languages from "@lucide/solid/icons/languages";
import Logs from "@lucide/solid/icons/logs";
import Wrench from "@lucide/solid/icons/wrench";
import {
	createEffect,
	createSignal,
	For,
	onSettled,
	Show,
	untrack,
} from "solid-js";
import type { z } from "zod";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../alert-dialog";
import { Button } from "../button";
import {
	FormError,
	FormFieldMessage,
	getFormErrorMessage,
} from "../form-message";
import { InferenceDeviceFields } from "../inference-device-fields";
import { Input } from "../input";
import { LanguageSettings } from "../language-settings";
import { Label } from "../label";
import { TAG_DICTIONARY_DETAIL_QUERY_KEY } from "../query-options/tags-query";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../select";
import { ShortcutSettingsPanel } from "../shortcuts/shortcut-settings-panel";
import {
	Switch,
	SwitchControl,
	SwitchDescription,
	SwitchLabel,
	SwitchThumb,
} from "../switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";
import { Textarea } from "../textarea";
import { toast } from "../toast";
import { CategoryLabel } from "../workspace/management-layout";

import { McpPublicationSettings } from "./mcp-publication-settings";

type AppConfigFormValues = z.input<typeof AppConfigSchema>;

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

type LogLevelOption = {
	value: LogLevel;
	label: string;
};

function parseCommaSeparatedList(raw: string): string[] {
	return raw
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function areStringArraysEqual(
	a: readonly string[],
	b: readonly string[],
): boolean {
	return a.length === b.length && a.every((item, index) => item === b[index]);
}

function CommaSeparatedTextarea(props: {
	id: string;
	value: string[] | undefined;
	placeholder?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: "true" | "false";
	onChange: (value: string[]) => void;
	onBlur: () => void;
}) {
	const [draft, setDraft] = createSignal(
		untrack(() => (props.value ?? []).join(", ")),
	);

	createEffect(
		() => props.value,
		(value) => {
			const external = value ?? [];
			if (!areStringArraysEqual(parseCommaSeparatedList(draft()), external)) {
				setDraft(external.join(", "));
			}
		},
	);

	return (
		<Textarea
			aria-describedby={props["aria-describedby"]}
			aria-invalid={props["aria-invalid"]}
			id={props.id}
			onBlur={() => {
				setDraft((props.value ?? []).join(", "));
				props.onBlur();
			}}
			onInput={(e) => {
				const raw = e.currentTarget.value;
				setDraft(raw);
				props.onChange(parseCommaSeparatedList(raw));
			}}
			placeholder={props.placeholder}
			value={draft()}
		/>
	);
}

function getLogLevelOptions(): LogLevelOption[] {
	return [
		{ value: "trace", label: t("configScreen.trace") },
		{ value: "debug", label: t("configScreen.debug") },
		{ value: "info", label: t("configScreen.info") },
		{ value: "warn", label: t("configScreen.warn") },
		{ value: "error", label: t("configScreen.error") },
		{ value: "fatal", label: t("configScreen.fatal") },
	];
}

const SETTINGS_CATEGORIES = [
	{
		get description() {
			return t("locale.description");
		},
		icon: Languages,
		get label() {
			return t("locale.category");
		},
		value: "interface",
	},
	{
		get description() {
			return t("configScreen.concurrencyAndAutomation");
		},
		icon: BriefcaseBusiness,
		get label() {
			return t("navigation.jobs");
		},
		value: "jobs",
	},
	{
		get description() {
			return t("configScreen.inferenceServiceConnection");
		},
		icon: Bot,
		get label() {
			return t("configScreen.aI");
		},
		value: "ai",
	},
	{
		get description() {
			return t("configScreen.downloadSpeedAndLimits");
		},
		icon: DownloadCloud,
		get label() {
			return t("configScreen.downloads");
		},
		value: "downloads",
	},
	{
		get description() {
			return t("configScreen.thumbnailsAndStorageLocations");
		},
		icon: HardDrive,
		get label() {
			return t("configScreen.storage");
		},
		value: "storage",
	},
	{
		get description() {
			return t("configScreen.formatsAndMetadata");
		},
		icon: Image,
		get label() {
			return t("configScreen.media");
		},
		value: "media",
	},
	{
		get description() {
			return t("configScreen.keyboardControlsForThisDevice");
		},
		icon: Keyboard,
		get label() {
			return t("configScreen.shortcuts");
		},
		value: "shortcuts",
	},
	{
		get description() {
			return t("configScreen.toolAvailability");
		},
		icon: Wrench,
		get label() {
			return t("configScreen.mCP");
		},
		value: "mcp",
	},
	{
		get description() {
			return t("configScreen.logOutputLevel");
		},
		icon: Logs,
		get label() {
			return t("configScreen.logging");
		},
		value: "logging",
	},
] as const;

type SettingsCategoryValue = (typeof SETTINGS_CATEGORIES)[number]["value"];

function fieldPathToCategory(path: string): SettingsCategoryValue | null {
	if (path.startsWith("jobs.")) return "jobs";
	if (path.startsWith("ai.")) return "ai";
	if (path.startsWith("downloads.")) return "downloads";
	if (path.startsWith("storage.")) return "storage";
	if (path.startsWith("media.") || path.startsWith("tagDictionary."))
		return "media";
	if (path === "mcp" || path.startsWith("mcp.")) return "mcp";
	if (path.startsWith("logging.")) return "logging";
	return null;
}

function getInvalidCategories(
	fieldMeta: Record<string, { errors?: readonly unknown[] } | undefined>,
	onChangeError: unknown,
): Set<SettingsCategoryValue> {
	const categories = new Set<SettingsCategoryValue>();
	for (const [path, meta] of Object.entries(fieldMeta)) {
		if (meta?.errors && meta.errors.length > 0) {
			const category = fieldPathToCategory(path);
			if (category) categories.add(category);
		}
	}
	if (onChangeError && typeof onChangeError === "object") {
		for (const [path, issues] of Object.entries(onChangeError)) {
			if (Array.isArray(issues) && issues.length > 0) {
				const category = fieldPathToCategory(path);
				if (category) categories.add(category);
			}
		}
	}
	return categories;
}

function toFormValues(data: AppConfig): AppConfigFormValues {
	return data;
}

function changedFields<T extends Record<string, unknown>>(
	before: T,
	after: T,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(after).filter(
			([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key]),
		),
	);
}

function parseNumberInput(val: string): number | undefined {
	const n = Number(val);
	return val === "" || Number.isNaN(n) ? undefined : n;
}
export type ConfigScreenProps = {
	checkAiHealth: () => Promise<AiHealthResponse>;
	data: AppConfig;
	onSubmit: (value: AppConfigUpdate) => Promise<AppConfig>;
	loadMcpCatalog: () => Promise<McpToolInfo[]>;
	onSubmitSuccess?: () => void;
};

export function ConfigScreen(props: ConfigScreenProps) {
	const queryClient = useQueryClient();
	const [isDesktop, setIsDesktop] = createSignal(true);
	const [activeTab, setActiveTab] = createSignal("interface");

	onSettled(() => {
		const media = window.matchMedia("(min-width: 1024px)");
		const update = () => setIsDesktop(media.matches);
		update();
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	});
	const [aiHealth, setAiHealth] = createSignal<AiHealthResponse | null>(null);
	const [aiHealthError, setAiHealthError] = createSignal<string | null>(null);
	const [isCheckingAiHealth, setIsCheckingAiHealth] = createSignal(false);
	const [submitError, setSubmitError] = createSignal<string | null>(null);
	const sectionClass = "min-w-0 space-y-5 border-b border-border pb-8";
	let baseline = untrack(() => props.data);
	const [baselineAi, setBaselineAi] = createSignal(baseline.ai);
	const form = createForm(() => ({
		defaultValues: toFormValues(props.data),
		validators: {
			onChange: AppConfigSchema,
		},
		onSubmit: async ({ value }) => {
			setSubmitError(null);
			try {
				const parsedValue = AppConfigSchema.parse(value);
				// Patch only edited sections, including each MCP surface independently.
				const patch = changedFields(baseline, parsedValue);
				if (patch.mcp) patch.mcp = changedFields(baseline.mcp, parsedValue.mcp);
				const previousWikiSetting = baseline.tagDictionary.fetchMissingWiki;
				const saved = await props.onSubmit(AppConfigUpdateSchema.parse(patch));
				if (saved.tagDictionary.fetchMissingWiki !== previousWikiSetting) {
					void queryClient.invalidateQueries({
						queryKey: TAG_DICTIONARY_DETAIL_QUERY_KEY,
					});
				}
				baseline = saved;
				setBaselineAi(saved.ai);
				form.reset(toFormValues(baseline));
				props.onSubmitSuccess?.();
				toast.success(t("configScreen.configurationSavedSuccessfully"));
			} catch (error) {
				setSubmitError(
					getFormErrorMessage(error) ??
						t("configScreen.failedToSaveConfiguration"),
				);
				toast.error(t("configScreen.failedToSaveConfiguration"));
			}
		},
	}));
	const navigationBlocker = useBlocker({
		shouldBlockFn: () => form.state.isDirty,
		enableBeforeUnload: () => form.state.isDirty,
		withResolver: true,
	});
	const checkAiHealth = async () => {
		if (isCheckingAiHealth()) return;
		setIsCheckingAiHealth(true);
		setAiHealthError(null);
		try {
			setAiHealth(await props.checkAiHealth());
		} catch (error) {
			setAiHealth(null);
			setAiHealthError(
				error instanceof Error
					? error.message
					: t("configScreen.healthCheckFailed"),
			);
		} finally {
			setIsCheckingAiHealth(false);
		}
	};

	createEffect(
		() => props.data,
		(data) => {
			if (!form.state.isDirty) {
				baseline = data;
				setBaselineAi(data.ai);
				form.reset(toFormValues(data));
			}
		},
	);

	return (
		<div class="min-w-0 space-y-6 [&_input]:text-base [&_select]:text-base [&_textarea]:text-base sm:[&_input]:text-sm sm:[&_select]:text-sm sm:[&_textarea]:text-sm">
			<FormError message={submitError()} />

			<form
				class="min-w-0 space-y-6"
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<Tabs
					class="grid w-full min-w-0 gap-6 lg:grid-cols-settings-sidebar xl:gap-8"
					onChange={setActiveTab}
					orientation={isDesktop() ? "vertical" : "horizontal"}
					value={activeTab()}
				>
					<form.Subscribe
						selector={(state) =>
							getInvalidCategories(state.fieldMeta, state.errorMap.onChange)
						}
					>
						{(invalidCategories) => (
							<TabsList
								aria-label={t("configScreen.settingsCategories")}
								class="sticky top-0 z-10 flex h-auto w-full min-w-0 flex-nowrap items-center justify-start gap-1 overflow-x-auto rounded-none border-border border-b bg-background py-1.5 lg:top-5 lg:flex-col lg:items-stretch lg:self-start lg:overflow-visible lg:border-b-0 lg:bg-transparent lg:py-0"
							>
								<For each={SETTINGS_CATEGORIES}>
									{(category) => {
										const Icon = category.icon;
										const hasError = () =>
											invalidCategories().has(category.value);
										return (
											<TabsTrigger
												aria-invalid={hasError() ? "true" : undefined}
												class="min-h-11 shrink-0 gap-2.5 whitespace-nowrap rounded-md px-2.5 text-muted-foreground shadow-none hover:bg-muted data-[selected]:bg-accent data-[selected]:text-primary data-[selected]:hover:bg-accent lg:min-h-10 lg:w-full lg:justify-start lg:whitespace-normal"
												type="button"
												value={category.value}
											>
												<CategoryLabel
													description={category.description}
													icon={<Icon aria-hidden="true" size={16} />}
													label={category.label}
												/>
												<Show when={hasError()}>
													<span
														aria-hidden="true"
														class="ml-auto size-2 shrink-0 rounded-full bg-destructive"
													/>
													<span class="sr-only">
														{t("configScreen.hasValidationErrors")}
													</span>
												</Show>
											</TabsTrigger>
										);
									}}
								</For>
							</TabsList>
						)}
					</form.Subscribe>

					<div class="min-w-0 space-y-6">
						<TabsContent value="interface">
							<form.Subscribe selector={(state) => state.isDirty}>
								{(isDirty) => <LanguageSettings disabled={isDirty()} />}
							</form.Subscribe>
						</TabsContent>
						<TabsContent value="jobs">
							<fieldset class={sectionClass}>
								<legend class="mb-4 block font-semibold text-xl">
									{t("configScreen.jobProcessing")}
								</legend>

								<form.Field name="jobs.concurrency">
									{(field) => (
										<div class="space-y-2">
											<Label for={field().name}>
												{t("configScreen.concurrency")}
											</Label>
											<Input
												aria-describedby={`${field().name}-error`}
												aria-invalid={
													field().state.meta.errors.length > 0
														? "true"
														: "false"
												}
												id={field().name}
												min={1}
												onBlur={field().handleBlur}
												onInput={(e) => {
													field().handleChange(
														parseNumberInput(e.target.value),
													);
												}}
												type="number"
												value={field().state.value ?? ""}
											/>
											<FormFieldMessage
												id={`${field().name}-error`}
												message={getFormErrorMessage(
													field().state.meta.errors[0],
												)}
											/>
											<div class="text-muted-foreground text-xs">
												{t(
													"configScreen.numberOfConcurrentDownloadsProcessings",
												)}
											</div>
										</div>
									)}
								</form.Field>

								<form.Field name="jobs.aiConcurrency">
									{(field) => (
										<div class="space-y-2">
											<Label for={field().name}>
												{t("configScreen.aIConcurrency")}
											</Label>
											<Input
												aria-describedby={`${field().name}-error`}
												aria-invalid={
													field().state.meta.errors.length > 0
														? "true"
														: "false"
												}
												id={field().name}
												min={1}
												onBlur={field().handleBlur}
												onInput={(e) => {
													field().handleChange(
														parseNumberInput(e.target.value),
													);
												}}
												type="number"
												value={field().state.value ?? ""}
											/>
											<FormFieldMessage
												id={`${field().name}-error`}
												message={getFormErrorMessage(
													field().state.meta.errors[0],
												)}
											/>
											<div class="text-muted-foreground text-xs">
												{t("configScreen.numberOfConcurrentAITaggingJobs")}
											</div>
										</div>
									)}
								</form.Field>

								<form.Field name="jobs.pollIntervalMs">
									{(field) => (
										<div class="space-y-2">
											<Label for={field().name}>
												{t("configScreen.pollIntervalMs")}
											</Label>
											<Input
												aria-describedby={`${field().name}-error`}
												aria-invalid={
													field().state.meta.errors.length > 0
														? "true"
														: "false"
												}
												id={field().name}
												min={100}
												onBlur={field().handleBlur}
												onInput={(e) => {
													field().handleChange(
														parseNumberInput(e.target.value),
													);
												}}
												type="number"
												value={field().state.value ?? ""}
											/>
											<FormFieldMessage
												id={`${field().name}-error`}
												message={getFormErrorMessage(
													field().state.meta.errors[0],
												)}
											/>
										</div>
									)}
								</form.Field>

								<form.Field name="jobs.enableAutoTagging">
									{(field) => (
										<div class="flex items-center space-x-2">
											<Switch
												checked={field().state.value ?? false}
												onChange={field().handleChange}
											>
												<SwitchControl>
													<SwitchThumb />
												</SwitchControl>
												<SwitchLabel>
													{t("configScreen.enableAutoTagging")}
												</SwitchLabel>
											</Switch>
										</div>
									)}
								</form.Field>

								<form.Field name="jobs.enableAutoCcipExtraction">
									{(field) => (
										<div class="flex items-center space-x-2">
											<Switch
												checked={field().state.value ?? false}
												onChange={field().handleChange}
											>
												<SwitchControl>
													<SwitchThumb />
												</SwitchControl>
												<SwitchLabel>
													{t("configScreen.enableAutoCCIPExtraction")}
												</SwitchLabel>
											</Switch>
										</div>
									)}
								</form.Field>
								<form.Field name="jobs.enableAutoEmbeddingExtraction">
									{(field) => (
										<Switch
											checked={field().state.value ?? false}
											onChange={field().handleChange}
										>
											<SwitchControl>
												<SwitchThumb />
											</SwitchControl>
											<SwitchLabel>
												{t("configScreen.enableAutoEmbeddingGemma2Extraction")}
											</SwitchLabel>
										</Switch>
									)}
								</form.Field>
							</fieldset>
						</TabsContent>

						<TabsContent value="ai">
							<fieldset class={sectionClass}>
								<legend class="mb-4 block font-semibold text-xl">
									{t("configScreen.aIService")}
								</legend>
								<div class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted px-3 py-2.5">
									<div aria-atomic="true" aria-live="polite">
										<div class="font-medium text-sm">
											{t("configScreen.connectionStatus")}
										</div>
										<Show
											fallback={
												<div
													class={
														aiHealthError()
															? "text-destructive text-xs"
															: "text-muted-foreground text-xs"
													}
												>
													{aiHealthError() ?? t("configScreen.notCheckedYet")}
												</div>
											}
											when={aiHealth()}
										>
											{(health) => (
												<div
													class={
														health().status === "available"
															? "text-primary text-xs"
															: "text-destructive text-xs"
													}
												>
													{health().status === "available"
														? t("configScreen.valueServiceAvailable", {
																value0: String(
																	health().mode === "remote"
																		? t("configScreen.remote")
																		: t("labels.local"),
																),
															})
														: (health().message ??
															t("configScreen.aIServiceUnavailable"))}
													<Show when={health().latencyMs !== null}>
														<span class="ml-2 text-muted-foreground">
															{t("configScreen.valueMs", {
																value0: String(health().latencyMs),
															})}
														</span>
													</Show>
												</div>
											)}
										</Show>
										<form.Subscribe
											selector={(state) =>
												JSON.stringify(state.values.ai) !==
												JSON.stringify(baselineAi())
											}
										>
											{(aiDirty) => (
												<Show when={aiDirty()}>
													<p class="mt-1 text-muted-foreground text-xs">
														{t("configScreen.healthCheckUsesSavedSettings")}
													</p>
												</Show>
											)}
										</form.Subscribe>
									</div>
									<Button
										aria-busy={isCheckingAiHealth() ? "true" : "false"}
										class="min-h-11 sm:min-h-9"
										disabled={isCheckingAiHealth()}
										onClick={() => void checkAiHealth()}
										size="sm"
										type="button"
										variant="outline"
									>
										{isCheckingAiHealth()
											? t("status.checking")
											: t("configScreen.checkNow")}
									</Button>
								</div>
								<form.Field name="ai.baseUrl">
									{(field) => (
										<div class="space-y-2">
											<Label for={field().name}>
												{t("configScreen.remoteAIServerURLORPC")}
											</Label>
											<Input
												aria-describedby={`${field().name}-help ${field().name}-example ${field().name}-error`}
												aria-invalid={
													field().state.meta.errors.length > 0
														? "true"
														: "false"
												}
												id={field().name}
												onBlur={field().handleBlur}
												onInput={(e) => field().handleChange(e.target.value)}
												value={field().state.value ?? ""}
											/>
											<FormFieldMessage
												id={`${field().name}-error`}
												message={getFormErrorMessage(
													field().state.meta.errors[0],
												)}
											/>
											<p
												class="text-muted-foreground text-xs"
												id={`${field().name}-help`}
											>
												{t("configScreen.remoteAiUrlHelp")}
											</p>
											<p
												class="text-muted-foreground text-xs"
												id={`${field().name}-example`}
											>
												{t("configScreen.remoteAiUrlExample", {
													url: "http://power-machine:3000",
												})}
											</p>
										</div>
									)}
								</form.Field>
								<form.Field name="ai.timeoutMs">
									{(field) => (
										<div class="space-y-2">
											<Label for={field().name}>
												{t("configScreen.timeoutMs")}
											</Label>
											<Input
												aria-describedby={`${field().name}-error`}
												aria-invalid={
													field().state.meta.errors.length > 0
														? "true"
														: "false"
												}
												id={field().name}
												min={1000}
												onBlur={field().handleBlur}
												onInput={(e) => {
													field().handleChange(
														parseNumberInput(e.target.value),
													);
												}}
												type="number"
												value={field().state.value ?? ""}
											/>
											<FormFieldMessage
												id={`${field().name}-error`}
												message={getFormErrorMessage(
													field().state.meta.errors[0],
												)}
											/>
										</div>
									)}
								</form.Field>
								<form.Field name="ai.provider">
									{(providerField) => (
										<form.Field name="ai.device">
											{(deviceField) => (
												<InferenceDeviceFields
													device={deviceField().state.value}
													deviceError={getFormErrorMessage(
														deviceField().state.meta.errors[0],
													)}
													onDeviceChange={(device) =>
														deviceField().handleChange(device || undefined)
													}
													onProviderChange={(provider) =>
														providerField().handleChange(provider)
													}
													provider={providerField().state.value ?? "auto"}
													providerError={getFormErrorMessage(
														providerField().state.meta.errors[0],
													)}
													idPrefix="ai-inference"
												/>
											)}
										</form.Field>
									)}
								</form.Field>
							</fieldset>
						</TabsContent>

						<TabsContent value="downloads">
							<fieldset class={sectionClass}>
								<legend class="mb-4 block font-semibold text-xl">
									{t("configScreen.downloads")}
								</legend>

								<form.Field name="downloads.rateLimitEnabled">
									{(field) => (
										<div class="flex items-center space-x-2">
											<Switch
												checked={field().state.value ?? false}
												onChange={field().handleChange}
											>
												<SwitchControl>
													<SwitchThumb />
												</SwitchControl>
												<SwitchLabel>
													{t("configScreen.enableRateLimiting")}
												</SwitchLabel>
											</Switch>
										</div>
									)}
								</form.Field>

								<form.Field name="downloads.requestIntervalMs">
									{(field) => (
										<div class="space-y-2">
											<Label for={field().name}>
												{t("configScreen.requestIntervalMs")}
											</Label>
											<Input
												aria-describedby={`${field().name}-error`}
												aria-invalid={
													field().state.meta.errors.length > 0
														? "true"
														: "false"
												}
												id={field().name}
												max="60000"
												min="0"
												onBlur={field().handleBlur}
												onInput={(e) => {
													field().handleChange(
														parseNumberInput(e.target.value),
													);
												}}
												type="number"
												value={field().state.value ?? ""}
											/>
											<FormFieldMessage
												id={`${field().name}-error`}
												message={getFormErrorMessage(
													field().state.meta.errors[0],
												)}
											/>
										</div>
									)}
								</form.Field>
							</fieldset>
						</TabsContent>

						<TabsContent value="storage">
							<fieldset class={sectionClass}>
								<legend class="mb-4 block font-semibold text-xl">
									{t("configScreen.storage")}
								</legend>
								<form.Field name="storage.thumbnailDir">
									{(field) => (
										<div class="space-y-2">
											<Label for={field().name}>
												{t("configScreen.thumbnailDirectory")}
											</Label>
											<Input
												aria-describedby={`${field().name}-error`}
												aria-invalid={
													field().state.meta.errors.length > 0
														? "true"
														: "false"
												}
												id={field().name}
												onBlur={field().handleBlur}
												onInput={(e) => field().handleChange(e.target.value)}
												value={field().state.value ?? ""}
											/>
											<FormFieldMessage
												id={`${field().name}-error`}
												message={getFormErrorMessage(
													field().state.meta.errors[0],
												)}
											/>
										</div>
									)}
								</form.Field>

								<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<form.Field name="storage.thumbnailSize">
										{(field) => (
											<div class="space-y-2">
												<Label for={field().name}>
													{t("configScreen.thumbnailSizePx")}
												</Label>
												<Input
													aria-describedby={`${field().name}-error`}
													aria-invalid={
														field().state.meta.errors.length > 0
															? "true"
															: "false"
													}
													id={field().name}
													max={4096}
													min={64}
													onBlur={field().handleBlur}
													onInput={(e) => {
														field().handleChange(
															parseNumberInput(e.target.value),
														);
													}}
													type="number"
													value={field().state.value ?? ""}
												/>
												<FormFieldMessage
													id={`${field().name}-error`}
													message={getFormErrorMessage(
														field().state.meta.errors[0],
													)}
												/>
											</div>
										)}
									</form.Field>
									<form.Field name="storage.thumbnailQuality">
										{(field) => (
											<div class="space-y-2">
												<Label for={field().name}>
													{t("configScreen.thumbnailQuality1100")}
												</Label>
												<Input
													aria-describedby={`${field().name}-error`}
													aria-invalid={
														field().state.meta.errors.length > 0
															? "true"
															: "false"
													}
													id={field().name}
													max={100}
													min={1}
													onBlur={field().handleBlur}
													onInput={(e) => {
														field().handleChange(
															parseNumberInput(e.target.value),
														);
													}}
													type="number"
													value={field().state.value ?? ""}
												/>
												<FormFieldMessage
													id={`${field().name}-error`}
													message={getFormErrorMessage(
														field().state.meta.errors[0],
													)}
												/>
											</div>
										)}
									</form.Field>
								</div>
							</fieldset>
						</TabsContent>

						<TabsContent value="media">
							<fieldset class={sectionClass}>
								<legend class="mb-4 block font-semibold text-xl">
									{t("tagDictionary.title")}
								</legend>
								<form.Field name="tagDictionary.fetchMissingWiki">
									{(field) => (
										<Switch
											class="space-y-2"
											checked={field().state.value ?? false}
											onChange={field().handleChange}
										>
											<div class="flex items-center gap-2">
												<SwitchControl>
													<SwitchThumb />
												</SwitchControl>
												<SwitchLabel class="leading-normal">
													{t("tagDictionary.fetchMissingWiki")}
												</SwitchLabel>
											</div>
											<SwitchDescription class="text-sm text-muted-foreground">
												{t("tagDictionary.fetchMissingWikiDescription")}
											</SwitchDescription>
										</Switch>
									)}
								</form.Field>
							</fieldset>

							<fieldset class={sectionClass}>
								<legend class="mb-4 block font-semibold text-xl">
									{t("configScreen.mediaExtensions")}
								</legend>

								<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
									<form.Field name="media.supportedExtensions.image">
										{(field) => (
											<div class="space-y-2">
												<Label for={field().name}>
													{t("configScreen.imageExtensions")}
												</Label>
												<CommaSeparatedTextarea
													aria-describedby={`${field().name}-error`}
													aria-invalid={
														field().state.meta.errors.length > 0
															? "true"
															: "false"
													}
													id={field().name}
													onBlur={field().handleBlur}
													onChange={field().handleChange}
													placeholder={t("configScreen.jpgPng")}
													value={field().state.value}
												/>
												<FormFieldMessage
													id={`${field().name}-error`}
													message={getFormErrorMessage(
														field().state.meta.errors[0],
													)}
												/>
												<div class="text-muted-foreground text-xs">
													{t("configScreen.commaSeparated")}
												</div>
											</div>
										)}
									</form.Field>
									<form.Field name="media.supportedExtensions.video">
										{(field) => (
											<div class="space-y-2">
												<Label for={field().name}>
													{t("configScreen.videoExtensions")}
												</Label>
												<CommaSeparatedTextarea
													aria-describedby={`${field().name}-error`}
													aria-invalid={
														field().state.meta.errors.length > 0
															? "true"
															: "false"
													}
													id={field().name}
													onBlur={field().handleBlur}
													onChange={field().handleChange}
													placeholder={t("configScreen.mp4Webm")}
													value={field().state.value}
												/>
												<FormFieldMessage
													id={`${field().name}-error`}
													message={getFormErrorMessage(
														field().state.meta.errors[0],
													)}
												/>
											</div>
										)}
									</form.Field>
									<form.Field name="media.supportedExtensions.audio">
										{(field) => (
											<div class="space-y-2">
												<Label for={field().name}>
													{t("configScreen.audioExtensions")}
												</Label>
												<CommaSeparatedTextarea
													aria-describedby={`${field().name}-error`}
													aria-invalid={
														field().state.meta.errors.length > 0
															? "true"
															: "false"
													}
													id={field().name}
													onBlur={field().handleBlur}
													onChange={field().handleChange}
													placeholder={t("configScreen.mp3Wav")}
													value={field().state.value}
												/>
												<FormFieldMessage
													id={`${field().name}-error`}
													message={getFormErrorMessage(
														field().state.meta.errors[0],
													)}
												/>
											</div>
										)}
									</form.Field>
								</div>

								<h3 class="mt-6 mb-2 font-semibold text-lg">
									{t("configScreen.tagExtractionComfyUI")}
								</h3>
								<form.Field name="media.tagExtraction.comfyui.positiveNodeTypes">
									{(field) => (
										<div class="space-y-2">
											<Label for={field().name}>
												{t("configScreen.positiveNodeTypes")}
											</Label>
											<CommaSeparatedTextarea
												aria-describedby={`${field().name}-error`}
												aria-invalid={
													field().state.meta.errors.length > 0
														? "true"
														: "false"
												}
												id={field().name}
												onBlur={field().handleBlur}
												onChange={field().handleChange}
												value={field().state.value}
											/>
											<FormFieldMessage
												id={`${field().name}-error`}
												message={getFormErrorMessage(
													field().state.meta.errors[0],
												)}
											/>
										</div>
									)}
								</form.Field>

								<form.Field name="media.tagExtraction.comfyui.negativeKeywords">
									{(field) => (
										<div class="space-y-2">
											<Label for={field().name}>
												{t("configScreen.negativeKeywords")}
											</Label>
											<CommaSeparatedTextarea
												aria-describedby={`${field().name}-error`}
												aria-invalid={
													field().state.meta.errors.length > 0
														? "true"
														: "false"
												}
												id={field().name}
												onBlur={field().handleBlur}
												onChange={field().handleChange}
												value={field().state.value}
											/>
											<FormFieldMessage
												id={`${field().name}-error`}
												message={getFormErrorMessage(
													field().state.meta.errors[0],
												)}
											/>
										</div>
									)}
								</form.Field>

								<form.Field name="media.tagExtraction.comfyui.negativeTags">
									{(field) => (
										<div class="space-y-2">
											<Label for={field().name}>
												{t("configScreen.negativeTags")}
											</Label>
											<CommaSeparatedTextarea
												aria-describedby={`${field().name}-error`}
												aria-invalid={
													field().state.meta.errors.length > 0
														? "true"
														: "false"
												}
												id={field().name}
												onBlur={field().handleBlur}
												onChange={field().handleChange}
												value={field().state.value}
											/>
											<FormFieldMessage
												id={`${field().name}-error`}
												message={getFormErrorMessage(
													field().state.meta.errors[0],
												)}
											/>
										</div>
									)}
								</form.Field>
							</fieldset>
						</TabsContent>

						<TabsContent value="logging">
							<fieldset class={sectionClass}>
								<legend class="mb-4 block font-semibold text-xl">
									{t("configScreen.logging")}
								</legend>
								<form.Field name="logging.level">
									{(field) => {
										const options = getLogLevelOptions();
										const selectedOption = () =>
											options.find(
												(option) => option.value === field().state.value,
											) ?? null;
										return (
											<div class="space-y-2">
												<Select<LogLevelOption>
													class="space-y-2"
													disallowEmptySelection
													itemComponent={(itemProps) => (
														<SelectItem item={itemProps.item}>
															{itemProps.item.rawValue.label}
														</SelectItem>
													)}
													onChange={(option) => {
														if (option) {
															field().handleChange(option.value);
														}
													}}
													options={options}
													optionTextValue="label"
													optionValue="value"
													value={selectedOption()}
												>
													<SelectLabel>
														{t("configScreen.logLevel")}
													</SelectLabel>
													<SelectTrigger
														class="w-full text-base sm:text-sm"
														id={field().name}
													>
														<SelectValue<LogLevelOption>>
															{(state) => state.selectedOption()?.label ?? ""}
														</SelectValue>
													</SelectTrigger>
													<SelectContent />
												</Select>
												<FormFieldMessage
													id={`${field().name}-error`}
													message={getFormErrorMessage(
														field().state.meta.errors[0],
													)}
												/>
											</div>
										);
									}}
								</form.Field>
							</fieldset>
						</TabsContent>

						<TabsContent value="mcp">
							<form.Field name="mcp">
								{(field) => (
									<McpPublicationSettings
										value={mcpConfigSchema.parse(field().state.value)}
										onChange={(value) => field().handleChange(value)}
										loadCatalog={props.loadMcpCatalog}
									/>
								)}
							</form.Field>
						</TabsContent>
						<TabsContent value="shortcuts">
							<ShortcutSettingsPanel
								description={t(
									"configScreen.recordANewKeyCombinationDisableAnActionOr",
								)}
								title={t("configScreen.keyboardShortcuts")}
							/>
						</TabsContent>
					</div>
				</Tabs>
				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						invalidCategories: getInvalidCategories(
							state.fieldMeta,
							state.errorMap.onChange,
						),
						isDirty: state.isDirty,
						isSubmitting: state.isSubmitting,
					})}
				>
					{(state) => {
						const invalidLabels = () =>
							SETTINGS_CATEGORIES.filter((category) =>
								state().invalidCategories.has(category.value),
							).map((category) => category.label);
						return (
							<Show when={state().isDirty}>
								<div class="sticky bottom-3 z-20 ml-auto flex w-fit max-w-full flex-wrap items-center justify-end gap-2 rounded-md border border-border bg-card p-2 shadow-lg backdrop-blur">
									<Show
										fallback={
											<span class="px-2 text-muted-foreground text-sm">
												{t("configScreen.unsavedChanges")}
											</span>
										}
										when={invalidLabels().length > 0}
									>
										<span class="px-2 text-destructive text-sm" role="alert">
											{t("configScreen.fixErrorsInCategories", {
												categories: invalidLabels().join(", "),
											})}
										</span>
									</Show>
									<Button
										class="min-h-11 sm:min-h-9"
										disabled={state().isSubmitting}
										onClick={() => {
											setSubmitError(null);
											baseline = props.data;
											setBaselineAi(baseline.ai);
											form.reset(toFormValues(baseline));
										}}
										type="button"
										variant="outline"
									>
										{t("actions.discard")}
									</Button>
									<Button
										class="min-h-11 sm:min-h-9"
										disabled={!state().canSubmit || state().isSubmitting}
										type="submit"
									>
										{state().isSubmitting
											? t("status.saving")
											: t("actions.saveChanges")}
									</Button>
								</div>
							</Show>
						);
					}}
				</form.Subscribe>
			</form>
			<AlertDialog
				onOpenChange={(open) => {
					const resolver = navigationBlocker();
					if (!open && resolver.status === "blocked") {
						resolver.reset?.();
					}
				}}
				open={navigationBlocker().status === "blocked"}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("configScreen.discardSettingsChanges")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t(
								"configScreen.youHaveUnsavedChangesLeavingThisPageWillDiscard",
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("configScreen.keepEditing")}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								const resolver = navigationBlocker();
								if (resolver.status !== "blocked") return;
								baseline = props.data;
								setBaselineAi(baseline.ai);
								form.reset(toFormValues(baseline));
								resolver.proceed?.();
							}}
						>
							{t("configScreen.discardAndLeave")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
