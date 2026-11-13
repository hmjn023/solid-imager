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
import { createForm } from "@tanstack/solid-form";
// oxlint-disable-next-line typescript/no-deprecated -- TanStack Router's current Solid custom navigation-blocking API is exported under this deprecated annotation.
import { useBlocker } from "@tanstack/solid-router";
import Bot from "lucide-solid/icons/bot";
import BriefcaseBusiness from "lucide-solid/icons/briefcase-business";
import DownloadCloud from "lucide-solid/icons/cloud-download";
import HardDrive from "lucide-solid/icons/hard-drive";
import Image from "lucide-solid/icons/image";
import Keyboard from "lucide-solid/icons/keyboard";
import Languages from "lucide-solid/icons/languages";
import Logs from "lucide-solid/icons/logs";
import Wrench from "lucide-solid/icons/wrench";
import { createEffect, createSignal, For, Show } from "solid-js";
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
import { ShortcutSettingsPanel } from "../shortcuts/shortcut-settings-panel";
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from "../switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";
import { Textarea } from "../textarea";
import { toast } from "../toast";
import { CategoryLabel } from "../workspace/management-layout";

import { McpPublicationSettings } from "./mcp-publication-settings";

type AppConfigFormValues = z.input<typeof AppConfigSchema>;

const SETTINGS_CATEGORIES = [
	{
		description: t("locale.description"),
		icon: Languages,
		label: t("locale.category"),
		value: "interface",
	},
	{
		description: t("configScreen.concurrencyAndAutomation"),
		icon: BriefcaseBusiness,
		label: t("navigation.jobs"),
		value: "jobs",
	},
	{
		description: t("configScreen.inferenceServiceConnection"),
		icon: Bot,
		label: t("configScreen.aI"),
		value: "ai",
	},
	{
		description: t("configScreen.downloadSpeedAndLimits"),
		icon: DownloadCloud,
		label: t("configScreen.downloads"),
		value: "downloads",
	},
	{
		description: t("configScreen.thumbnailsAndStorageLocations"),
		icon: HardDrive,
		label: t("configScreen.storage"),
		value: "storage",
	},
	{
		description: t("configScreen.formatsAndMetadata"),
		icon: Image,
		label: t("configScreen.media"),
		value: "media",
	},
	{
		description: t("configScreen.keyboardControlsForThisDevice"),
		icon: Keyboard,
		label: t("configScreen.shortcuts"),
		value: "shortcuts",
	},
	{
		description: t("configScreen.toolAvailability"),
		icon: Wrench,
		label: t("configScreen.mCP"),
		value: "mcp",
	},
	{
		description: t("configScreen.logOutputLevel"),
		icon: Logs,
		label: t("configScreen.logging"),
		value: "logging",
	},
] as const;

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
	const [activeTab, setActiveTab] = createSignal("jobs");
	const [aiHealth, setAiHealth] = createSignal<AiHealthResponse | null>(null);
	const [aiHealthError, setAiHealthError] = createSignal<string | null>(null);
	const [isCheckingAiHealth, setIsCheckingAiHealth] = createSignal(false);
	const [submitError, setSubmitError] = createSignal<string | null>(null);
	const sectionClass = "min-w-0 space-y-5 border-b border-border pb-8";
	let baseline = props.data;
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
				baseline = await props.onSubmit(AppConfigUpdateSchema.parse(patch));
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

	createEffect(() => {
		const data = props.data;
		if (!form.state.isDirty) {
			baseline = data;
			form.reset(toFormValues(data));
		}
	});

	return (
		<div class="min-w-0 space-y-6 [&_input]:scroll-mt-28 [&_input]:text-base [&_select]:scroll-mt-28 [&_select]:text-base [&_textarea]:scroll-mt-28 [&_textarea]:text-base sm:[&_input]:text-sm sm:[&_select]:text-sm sm:[&_textarea]:text-sm">
			<FormError message={submitError()} />

			<form
				class="min-w-0 space-y-6"
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<Tabs
					class="grid min-w-0 w-full gap-6 lg:grid-cols-settings-sidebar xl:gap-8"
					onChange={setActiveTab}
					value={activeTab()}
				>
					<TabsList
						aria-label={t("configScreen.settingsCategories")}
						class="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0 lg:sticky lg:top-0 lg:flex-col lg:self-start lg:overflow-visible"
					>
						<For each={SETTINGS_CATEGORIES}>
							{(category) => {
								const Icon = category.icon;
								return (
									<TabsTrigger
										class="min-h-11 shrink-0 gap-2.5 rounded-md px-2.5 text-muted-foreground shadow-none data-[selected]:bg-accent data-[selected]:text-primary lg:min-h-10 lg:w-full lg:justify-start"
										type="button"
										value={category.value}
									>
										<CategoryLabel
											description={category.description}
											icon={<Icon aria-hidden="true" size={16} />}
											label={category.label}
										/>
									</TabsTrigger>
								);
							}}
						</For>
					</TabsList>

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
												aria-invalid={field().state.meta.errors.length > 0}
												id={field().name}
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
												aria-invalid={field().state.meta.errors.length > 0}
												id={field().name}
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
												aria-invalid={field().state.meta.errors.length > 0}
												id={field().name}
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
									<div>
										<div class="font-medium text-sm">
											{t("configScreen.connectionStatus")}
										</div>
										<Show
											fallback={
												<div class="text-muted-foreground text-xs">
													{aiHealthError() ?? t("configScreen.notCheckedYet")}
												</div>
											}
											when={aiHealth()}
										>
											{(health) => (
												<div
													aria-atomic="true"
													aria-live="polite"
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
									</div>
									<Button
										aria-busy={isCheckingAiHealth()}
										disabled={isCheckingAiHealth()}
										onClick={() => void checkAiHealth()}
										size="sm"
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
												aria-describedby={`${field().name}-error`}
												aria-invalid={field().state.meta.errors.length > 0}
												id={field().name}
												onBlur={field().handleBlur}
												onInput={(e) => field().handleChange(e.target.value)}
												placeholder={t("configScreen.httpPowerMachine3000")}
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
													"configScreen.useAnotherSolidImagerServerSORPCEndpointFor",
												)}
											</div>
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
												id={field().name}
												onBlur={field().handleBlur}
												onInput={(e) => {
													field().handleChange(
														parseNumberInput(e.target.value),
													);
												}}
												type="number"
												value={field().state.value ?? ""}
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
												aria-invalid={field().state.meta.errors.length > 0}
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
												id={field().name}
												onBlur={field().handleBlur}
												onInput={(e) => field().handleChange(e.target.value)}
												value={field().state.value ?? ""}
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
													id={field().name}
													onBlur={field().handleBlur}
													onInput={(e) => {
														field().handleChange(
															parseNumberInput(e.target.value),
														);
													}}
													type="number"
													value={field().state.value ?? ""}
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
													id={field().name}
													onBlur={field().handleBlur}
													onInput={(e) => {
														field().handleChange(
															parseNumberInput(e.target.value),
														);
													}}
													type="number"
													value={field().state.value ?? ""}
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
									{t("configScreen.mediaExtensions")}
								</legend>

								<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
									<form.Field name="media.supportedExtensions.image">
										{(field) => (
											<div class="space-y-2">
												<Label for={field().name}>
													{t("configScreen.imageExtensions")}
												</Label>
												<Textarea
													id={field().name}
													onBlur={field().handleBlur}
													onInput={(e) => {
														const val = e.target.value;
														const list = val
															.split(",")
															.map((s) => s.trim())
															.filter(Boolean);
														field().handleChange(list);
													}}
													placeholder={t("configScreen.jpgPng")}
													value={field().state.value?.join(", ") ?? ""}
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
												<Textarea
													id={field().name}
													onBlur={field().handleBlur}
													onInput={(e) => {
														const val = e.target.value;
														const list = val
															.split(",")
															.map((s) => s.trim())
															.filter(Boolean);
														field().handleChange(list);
													}}
													placeholder={t("configScreen.mp4Webm")}
													value={field().state.value?.join(", ") ?? ""}
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
												<Textarea
													id={field().name}
													onBlur={field().handleBlur}
													onInput={(e) => {
														const val = e.target.value;
														const list = val
															.split(",")
															.map((s) => s.trim())
															.filter(Boolean);
														field().handleChange(list);
													}}
													placeholder={t("configScreen.mp3Wav")}
													value={field().state.value?.join(", ") ?? ""}
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
											<Textarea
												id={field().name}
												onBlur={field().handleBlur}
												onInput={(e) => {
													const val = e.target.value;
													const list = val
														.split(",")
														.map((s) => s.trim())
														.filter(Boolean);
													field().handleChange(list);
												}}
												value={field().state.value?.join(", ") ?? ""}
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
											<Textarea
												id={field().name}
												onBlur={field().handleBlur}
												onInput={(e) => {
													const val = e.target.value;
													const list = val
														.split(",")
														.map((s) => s.trim())
														.filter(Boolean);
													field().handleChange(list);
												}}
												value={field().state.value?.join(", ") ?? ""}
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
											<Textarea
												id={field().name}
												onBlur={field().handleBlur}
												onInput={(e) => {
													const val = e.target.value;
													const list = val
														.split(",")
														.map((s) => s.trim())
														.filter(Boolean);
													field().handleChange(list);
												}}
												value={field().state.value?.join(", ") ?? ""}
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
									{(field) => (
										<div class="space-y-2">
											<Label for={field().name}>
												{t("configScreen.logLevel")}
											</Label>
											<select
												class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
												id={field().name}
												onInput={(e) =>
													field().handleChange(
														e.target.value as
															| "trace"
															| "debug"
															| "info"
															| "warn"
															| "error"
															| "fatal",
													)
												}
												value={field().state.value ?? ""}
											>
												<option value="trace">{t("configScreen.trace")}</option>
												<option value="debug">{t("configScreen.debug")}</option>
												<option value="info">{t("configScreen.info")}</option>
												<option value="warn">{t("configScreen.warn")}</option>
												<option value="error">{t("configScreen.error")}</option>
												<option value="fatal">{t("configScreen.fatal")}</option>
											</select>
										</div>
									)}
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
						isDirty: state.isDirty,
						isSubmitting: state.isSubmitting,
					})}
				>
					{(state) => (
						<Show when={state().isDirty}>
							<div class="sticky bottom-3 z-20 ml-auto flex w-fit items-center gap-2 rounded-md border border-border bg-card p-2 shadow-lg backdrop-blur">
								<span class="px-2 text-muted-foreground text-sm">
									{t("configScreen.unsavedChanges")}
								</span>
								<Button
									disabled={state().isSubmitting}
									onClick={() => {
										setSubmitError(null);
										baseline = props.data;
										form.reset(toFormValues(baseline));
									}}
									type="button"
									variant="outline"
								>
									{t("actions.discard")}
								</Button>
								<Button
									disabled={!state().canSubmit || state().isSubmitting}
									type="submit"
								>
									{state().isSubmitting
										? t("status.saving")
										: t("actions.saveChanges")}
								</Button>
							</div>
						</Show>
					)}
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
