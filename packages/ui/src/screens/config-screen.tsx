import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { AppConfigSchema } from "@solid-imager/core/domain/config/config-schema";
import { createForm } from "@tanstack/solid-form";
import { createSignal, Show } from "solid-js";
import { Button } from "../button";
import { Input } from "../input";
import { Label } from "../label";
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from "../switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";
import { Textarea } from "../textarea";
import { toast } from "../toast";

type DeepFormConfig<T> = T extends number
	? number | undefined
	: T extends Array<infer U>
		? Array<DeepFormConfig<U>>
		: T extends object
			? { [K in keyof T]: DeepFormConfig<T[K]> }
			: T;

type FormConfig = DeepFormConfig<AppConfig>;

function parseNumberInput(val: string): number | undefined {
	const n = Number(val);
	return val === "" || Number.isNaN(n) ? undefined : n;
}
export type ConfigScreenProps = {
	data: AppConfig;
	onSubmit: (value: Partial<AppConfig>) => Promise<void>;
	onSubmitSuccess?: () => void;
};

export function ConfigScreen(props: ConfigScreenProps) {
	const [activeTab, setActiveTab] = createSignal("jobs");
	const form = createForm(() => ({
		defaultValues: props.data as unknown as FormConfig,
		validators: {
			onChange: AppConfigSchema as never,
		},
		onSubmit: async ({ value }) => {
			try {
				await props.onSubmit(value as Partial<AppConfig>);
				props.onSubmitSuccess?.();
				toast.success("Configuration saved successfully");
			} catch (_error) {
				toast.error("Failed to save configuration");
			}
		},
	}));

	return (
		<div class="min-w-0 space-y-6 [&_input]:scroll-mt-28 [&_input]:text-base [&_select]:scroll-mt-28 [&_select]:text-base [&_textarea]:scroll-mt-28 [&_textarea]:text-base sm:[&_input]:text-sm sm:[&_select]:text-sm sm:[&_textarea]:text-sm">
			<div class="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 -mx-3 flex flex-col gap-3 border-b bg-background px-3 py-3 sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
				<h1 class="font-bold text-2xl sm:text-3xl">Settings</h1>
				<Button
					class="w-full sm:w-auto"
					disabled={form.state.isSubmitting}
					onClick={() => {
						void form.handleSubmit();
					}}
				>
					{form.state.isSubmitting ? "Saving..." : "Save Changes"}
				</Button>
			</div>

			<Tabs class="min-w-0 w-full" onChange={setActiveTab} value={activeTab()}>
				<TabsList
					aria-label="Settings categories"
					class="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-md p-1 md:grid md:grid-cols-6 md:overflow-visible"
				>
					<TabsTrigger class="min-h-11 shrink-0" type="button" value="jobs">
						Jobs
					</TabsTrigger>
					<TabsTrigger class="min-h-11 shrink-0" type="button" value="ai">
						AI
					</TabsTrigger>
					<TabsTrigger
						class="min-h-11 shrink-0"
						type="button"
						value="downloads"
					>
						Downloads
					</TabsTrigger>
					<TabsTrigger class="min-h-11 shrink-0" type="button" value="storage">
						Storage
					</TabsTrigger>
					<TabsTrigger class="min-h-11 shrink-0" type="button" value="media">
						Media
					</TabsTrigger>
					<TabsTrigger class="min-h-11 shrink-0" type="button" value="logging">
						Logging
					</TabsTrigger>
				</TabsList>

				<div class="mt-4 space-y-4 sm:mt-6 sm:space-y-6">
					<TabsContent value="jobs">
						<div class="space-y-4 rounded-md border p-3 sm:p-4">
							<h2 class="mb-4 font-semibold text-xl">Job Processing</h2>

							<form.Field name="jobs.concurrency">
								{(field) => (
									<div class="space-y-2">
										<Label for={field().name}>Concurrency</Label>
										<Input
											id={field().name}
											onBlur={field().handleBlur}
											onInput={(e) => {
												field().handleChange(parseNumberInput(e.target.value));
											}}
											type="number"
											value={field().state.value ?? ""}
										/>
										<Show when={field().state.meta.errors.length}>
											<div class="text-red-500 text-sm">
												{field().state.meta.errors[0]}
											</div>
										</Show>
										<div class="text-muted-foreground text-xs">
											Number of concurrent downloads/processings.
										</div>
									</div>
								)}
							</form.Field>

							<form.Field name="jobs.aiConcurrency">
								{(field) => (
									<div class="space-y-2">
										<Label for={field().name}>AI Concurrency</Label>
										<Input
											id={field().name}
											onBlur={field().handleBlur}
											onInput={(e) => {
												field().handleChange(parseNumberInput(e.target.value));
											}}
											type="number"
											value={field().state.value ?? ""}
										/>
										<Show when={field().state.meta.errors.length}>
											<div class="text-red-500 text-sm">
												{field().state.meta.errors[0]}
											</div>
										</Show>
										<div class="text-muted-foreground text-xs">
											Number of concurrent AI tagging jobs.
										</div>
									</div>
								)}
							</form.Field>

							<form.Field name="jobs.pollIntervalMs">
								{(field) => (
									<div class="space-y-2">
										<Label for={field().name}>Poll Interval (ms)</Label>
										<Input
											id={field().name}
											onBlur={field().handleBlur}
											onInput={(e) => {
												field().handleChange(parseNumberInput(e.target.value));
											}}
											type="number"
											value={field().state.value ?? ""}
										/>
										<Show when={field().state.meta.errors.length}>
											<div class="text-red-500 text-sm">
												{field().state.meta.errors[0]}
											</div>
										</Show>
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
											<SwitchLabel>Enable Auto Tagging</SwitchLabel>
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
											<SwitchLabel>Enable Auto CCIP Extraction</SwitchLabel>
										</Switch>
									</div>
								)}
							</form.Field>
						</div>
					</TabsContent>

					<TabsContent value="ai">
						<div class="space-y-4 rounded-md border p-3 sm:p-4">
							<h2 class="mb-4 font-semibold text-xl">AI Service</h2>
							<form.Field name="ai.baseUrl">
								{(field) => (
									<div class="space-y-2">
										<Label for={field().name}>
											Remote AI Server URL (oRPC)
										</Label>
										<Input
											id={field().name}
											onBlur={field().handleBlur}
											onInput={(e) => field().handleChange(e.target.value)}
											placeholder="http://power-machine:3000"
											value={field().state.value ?? ""}
										/>
										<div class="text-muted-foreground text-xs">
											外部の solid-imager サーバーの oRPC
											エンドポイントを指定。AI
											処理をリモートに委託します。空欄の場合はローカルで処理します。
										</div>
									</div>
								)}
							</form.Field>
							<form.Field name="ai.timeoutMs">
								{(field) => (
									<div class="space-y-2">
										<Label for={field().name}>Timeout (ms)</Label>
										<Input
											id={field().name}
											onBlur={field().handleBlur}
											onInput={(e) => {
												field().handleChange(parseNumberInput(e.target.value));
											}}
											type="number"
											value={field().state.value ?? ""}
										/>
									</div>
								)}
							</form.Field>
						</div>
					</TabsContent>

					<TabsContent value="downloads">
						<div class="space-y-4 rounded-md border p-3 sm:p-4">
							<h2 class="mb-4 font-semibold text-xl">Downloads</h2>

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
											<SwitchLabel>レートリミット有効</SwitchLabel>
										</Switch>
									</div>
								)}
							</form.Field>

							<form.Field name="downloads.requestIntervalMs">
								{(field) => (
									<div class="space-y-2">
										<Label for={field().name}>リクエスト間隔 (ms)</Label>
										<Input
											id={field().name}
											max="60000"
											min="0"
											onBlur={field().handleBlur}
											onInput={(e) => {
												field().handleChange(parseNumberInput(e.target.value));
											}}
											type="number"
											value={field().state.value ?? ""}
										/>
										<Show when={field().state.meta.errors.length}>
											<div class="text-red-500 text-sm">
												{field().state.meta.errors[0]}
											</div>
										</Show>
									</div>
								)}
							</form.Field>
						</div>
					</TabsContent>

					<TabsContent value="storage">
						<div class="space-y-4 rounded-md border p-3 sm:p-4">
							<h2 class="mb-4 font-semibold text-xl">Storage</h2>
							<form.Field name="storage.thumbnailDir">
								{(field) => (
									<div class="space-y-2">
										<Label for={field().name}>Thumbnail Directory</Label>
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
											<Label for={field().name}>Thumbnail Size (px)</Label>
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
												Thumbnail Quality (1-100)
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
						</div>
					</TabsContent>

					<TabsContent value="media">
						<div class="space-y-4 rounded-md border p-3 sm:p-4">
							<h2 class="mb-4 font-semibold text-xl">Media Extensions</h2>

							<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
								<form.Field name="media.supportedExtensions.image">
									{(field) => (
										<div class="space-y-2">
											<Label for={field().name}>Image Extensions</Label>
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
												placeholder=".jpg, .png"
												value={field().state.value?.join(", ") ?? ""}
											/>
											<div class="text-muted-foreground text-xs">
												Comma separated
											</div>
										</div>
									)}
								</form.Field>
								<form.Field name="media.supportedExtensions.video">
									{(field) => (
										<div class="space-y-2">
											<Label for={field().name}>Video Extensions</Label>
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
												placeholder=".mp4, .webm"
												value={field().state.value?.join(", ") ?? ""}
											/>
										</div>
									)}
								</form.Field>
								<form.Field name="media.supportedExtensions.audio">
									{(field) => (
										<div class="space-y-2">
											<Label for={field().name}>Audio Extensions</Label>
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
												placeholder=".mp3, .wav"
												value={field().state.value?.join(", ") ?? ""}
											/>
										</div>
									)}
								</form.Field>
							</div>

							<h3 class="mt-6 mb-2 font-semibold text-lg">
								Tag Extraction (ComfyUI)
							</h3>
							<form.Field name="media.tagExtraction.comfyui.positiveNodeTypes">
								{(field) => (
									<div class="space-y-2">
										<Label for={field().name}>Positive Node Types</Label>
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
										<Label for={field().name}>Negative Keywords</Label>
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
										<Label for={field().name}>Negative Tags</Label>
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
						</div>
					</TabsContent>

					<TabsContent value="logging">
						<div class="space-y-4 rounded-md border p-3 sm:p-4">
							<h2 class="mb-4 font-semibold text-xl">Logging</h2>
							<form.Field name="logging.level">
								{(field) => (
									<div class="space-y-2">
										<Label for={field().name}>Log Level</Label>
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
											<option value="trace">Trace</option>
											<option value="debug">Debug</option>
											<option value="info">Info</option>
											<option value="warn">Warn</option>
											<option value="error">Error</option>
											<option value="fatal">Fatal</option>
										</select>
									</div>
								)}
							</form.Field>
						</div>
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}
