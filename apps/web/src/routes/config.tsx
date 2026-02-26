import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { AppConfigSchema } from "@solid-imager/core/domain/config/config-schema";
import { createForm } from "@tanstack/solid-form";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { Show } from "solid-js";
import toast from "solid-toast";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Switch,
	SwitchControl,
	SwitchLabel,
	SwitchThumb,
} from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

function ConfigForm(props: { data: AppConfig }) {
	const queryClient = useQueryClient();

	const form = createForm(() => ({
		defaultValues: props.data,
		validatorAdapter: zodValidator(),
		validators: {
			// biome-ignore lint/suspicious/noExplicitAny: library type mismatch
			onChange: AppConfigSchema as any,
		},
		onSubmit: async ({ value }) => {
			try {
				await orpc.config.update(value as Partial<AppConfig>);
				toast.success("Configuration saved successfully");
				await queryClient.invalidateQueries({ queryKey: ["config"] });
			} catch (_error) {
				toast.error("Failed to save configuration");
			}
		},
	}));

	return (
		<>
			<div class="mb-6 flex items-center justify-between">
				<h1 class="font-bold text-3xl">Settings</h1>
				<Button
					disabled={form.state.isSubmitting}
					onClick={() => form.handleSubmit()}
				>
					{form.state.isSubmitting ? "Saving..." : "Save Changes"}
				</Button>
			</div>

			<Tabs class="w-full" defaultValue="jobs">
				<TabsList class="grid w-full grid-cols-5">
					<TabsTrigger value="jobs">Jobs</TabsTrigger>
					<TabsTrigger value="ai">AI</TabsTrigger>
					<TabsTrigger value="storage">Storage</TabsTrigger>
					<TabsTrigger value="media">Media</TabsTrigger>
					<TabsTrigger value="logging">Logging</TabsTrigger>
				</TabsList>

				<div class="mt-6 space-y-6">
					<TabsContent value="jobs">
						<div class="space-y-4 rounded-md border p-4">
							<h2 class="mb-4 font-semibold text-xl">Job Processing</h2>

							<form.Field name="jobs.concurrency">
								{(field) => (
									<div class="space-y-2">
										<Label for={field().name}>Concurrency</Label>
										<Input
											id={field().name}
											onBlur={field().handleBlur}
											onInput={(e) => {
												const val = e.target.value;
												field().handleChange(
													(val === ""
														? undefined
														: Number(val)) as unknown as number,
												);
											}}
											type="number"
											value={(field().state.value as number) ?? ""}
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
												const val = e.target.value;
												field().handleChange(
													(val === ""
														? undefined
														: Number(val)) as unknown as number,
												);
											}}
											type="number"
											value={(field().state.value as number) ?? ""}
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
												const val = e.target.value;
												field().handleChange(
													(val === ""
														? undefined
														: Number(val)) as unknown as number,
												);
											}}
											type="number"
											value={(field().state.value as number) ?? ""}
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
											checked={(field().state.value as boolean) ?? false}
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
						</div>
					</TabsContent>

					<TabsContent value="ai">
						<div class="space-y-4 rounded-md border p-4">
							<h2 class="mb-4 font-semibold text-xl">AI Service</h2>
							<form.Field name="ai.baseUrl">
								{(field) => (
									<div class="space-y-2">
										<Label for={field().name}>Base URL</Label>
										<Input
											id={field().name}
											onBlur={field().handleBlur}
											onInput={(e) =>
												// biome-ignore lint/suspicious/noExplicitAny: explicit cast to fix type error
												field().handleChange(e.target.value as any)
											}
											value={(field().state.value as string) ?? ""}
										/>
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
												const val = e.target.value;
												field().handleChange(
													(val === ""
														? undefined
														: Number(val)) as unknown as number,
												);
											}}
											type="number"
											value={(field().state.value as number) ?? ""}
										/>
									</div>
								)}
							</form.Field>
						</div>
					</TabsContent>

					<TabsContent value="storage">
						<div class="space-y-4 rounded-md border p-4">
							<h2 class="mb-4 font-semibold text-xl">Storage</h2>
							<form.Field name="storage.thumbnailDir">
								{(field) => (
									<div class="space-y-2">
										<Label for={field().name}>Thumbnail Directory</Label>
										<Input
											id={field().name}
											onBlur={field().handleBlur}
											onInput={(e) =>
												// biome-ignore lint/suspicious/noExplicitAny: explicit cast to fix type error
												field().handleChange(e.target.value as any)
											}
											value={(field().state.value as string) ?? ""}
										/>
									</div>
								)}
							</form.Field>

							<div class="grid grid-cols-2 gap-4">
								<form.Field name="storage.thumbnailSize">
									{(field) => (
										<div class="space-y-2">
											<Label for={field().name}>Thumbnail Size (px)</Label>
											<Input
												id={field().name}
												onBlur={field().handleBlur}
												onInput={(e) => {
													const val = e.target.value;
													field().handleChange(
														(val === ""
															? undefined
															: Number(val)) as unknown as number,
													);
												}}
												type="number"
												value={(field().state.value as number) ?? ""}
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
													const val = e.target.value;
													field().handleChange(
														(val === ""
															? undefined
															: Number(val)) as unknown as number,
													);
												}}
												type="number"
												value={(field().state.value as number) ?? ""}
											/>
										</div>
									)}
								</form.Field>
							</div>
						</div>
					</TabsContent>

					<TabsContent value="media">
						<div class="space-y-4 rounded-md border p-4">
							<h2 class="mb-4 font-semibold text-xl">Media Extensions</h2>

							<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
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
												value={
													(field().state.value as string[] | undefined)?.join(
														", ",
													) ?? ""
												}
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
												value={
													(field().state.value as string[] | undefined)?.join(
														", ",
													) ?? ""
												}
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
												value={
													(field().state.value as string[] | undefined)?.join(
														", ",
													) ?? ""
												}
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
											value={
												(field().state.value as string[] | undefined)?.join(
													", ",
												) ?? ""
											}
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
											value={
												(field().state.value as string[] | undefined)?.join(
													", ",
												) ?? ""
											}
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
											value={
												(field().state.value as string[] | undefined)?.join(
													", ",
												) ?? ""
											}
										/>
									</div>
								)}
							</form.Field>
						</div>
					</TabsContent>

					<TabsContent value="logging">
						<div class="space-y-4 rounded-md border p-4">
							<h2 class="mb-4 font-semibold text-xl">Logging</h2>
							<form.Field name="logging.level">
								{(field) => (
									<div class="space-y-2">
										<Label for={field().name}>Log Level</Label>
										<select
											class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
											id={field().name}
											onInput={(e) =>
												// biome-ignore lint/suspicious/noExplicitAny: explicit cast to fix type error
												field().handleChange(e.target.value as any)
											}
											value={(field().state.value as string) ?? ""}
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
		</>
	);
}

export default function ConfigPage() {
	const configQuery = createQuery(() => ({
		queryKey: ["config"],
		queryFn: async () => await orpc.config.get(),
	}));

	return (
		<div class="container mx-auto max-w-4xl p-6">
			<Show when={configQuery.isLoading}>
				<div class="py-10 text-center">Loading settings...</div>
			</Show>

			<Show when={configQuery.isError}>
				<div class="py-10 text-red-500">Error loading settings.</div>
			</Show>

			<Show when={configQuery.data}>
				{(data) => <ConfigForm data={data()} />}
			</Show>
		</div>
	);
}
