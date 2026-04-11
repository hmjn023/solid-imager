import {
	type AppConfig,
	defaultAppConfig,
} from "@solid-imager/core/domain/config/config-schema";
import { Button } from "@solid-imager/ui/button";
import { Input } from "@solid-imager/ui/input";
import { Label } from "@solid-imager/ui/label";
import {
	Switch,
	SwitchControl,
	SwitchLabel,
	SwitchThumb,
} from "@solid-imager/ui/switch";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@solid-imager/ui/tabs";
import { Textarea } from "@solid-imager/ui/textarea";
import { toast } from "@solid-imager/ui/toast";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { createEffect } from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";
import { orpc } from "../infrastructure/api-clients/orpc-client";
import { configQueryOptions } from "../infrastructure/api-clients/queries/config-query";

export const Route = createFileRoute("/config")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(configQueryOptions());
	},
	component: ConfigPage,
});

function parseList(value: string) {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

export default function ConfigPage() {
	const queryClient = useQueryClient();
	const configQuery = createQuery(() => configQueryOptions());
	const [config, setConfig] = createStore<AppConfig>(
		structuredClone(defaultAppConfig),
	);

	createEffect(() => {
		if (configQuery.data) {
			setConfig(reconcile(structuredClone(unwrap(configQuery.data))));
		}
	});

	const handleSave = async () => {
		await orpc.config.update(config);
		toast.success("Configuration saved successfully");
		await queryClient.invalidateQueries({ queryKey: ["config"] });
	};

	return (
		<div class="container mx-auto max-w-4xl p-6">
			<div class="mb-6 flex items-center justify-between">
				<h1 class="font-bold text-3xl">Settings</h1>
				<Button onClick={handleSave}>Save Changes</Button>
			</div>

			<Tabs class="w-full" defaultValue="jobs">
				<TabsList class="grid w-full grid-cols-6">
					<TabsTrigger value="jobs">Jobs</TabsTrigger>
					<TabsTrigger value="ai">AI</TabsTrigger>
					<TabsTrigger value="downloads">Downloads</TabsTrigger>
					<TabsTrigger value="storage">Storage</TabsTrigger>
					<TabsTrigger value="media">Media</TabsTrigger>
					<TabsTrigger value="logging">Logging</TabsTrigger>
				</TabsList>

				<div class="mt-6 space-y-6">
					<TabsContent value="jobs">
						<div class="space-y-4 rounded-md border p-4">
							<h2 class="mb-4 font-semibold text-xl">Job Processing</h2>

							<div class="space-y-2">
								<Label for="jobs-concurrency">Concurrency</Label>
								<Input
									id="jobs-concurrency"
									onInput={(event) =>
										setConfig(
											"jobs",
											"concurrency",
											Number(event.currentTarget.value),
										)
									}
									type="number"
									value={config.jobs.concurrency}
								/>
								<div class="text-muted-foreground text-xs">
									Number of concurrent downloads/processings.
								</div>
							</div>

							<div class="space-y-2">
								<Label for="jobs-ai-concurrency">AI Concurrency</Label>
								<Input
									id="jobs-ai-concurrency"
									onInput={(event) =>
										setConfig(
											"jobs",
											"aiConcurrency",
											Number(event.currentTarget.value),
										)
									}
									type="number"
									value={config.jobs.aiConcurrency}
								/>
								<div class="text-muted-foreground text-xs">
									Number of concurrent AI tagging jobs.
								</div>
							</div>

							<div class="space-y-2">
								<Label for="jobs-poll">Poll Interval (ms)</Label>
								<Input
									id="jobs-poll"
									onInput={(event) =>
										setConfig(
											"jobs",
											"pollIntervalMs",
											Number(event.currentTarget.value),
										)
									}
									type="number"
									value={config.jobs.pollIntervalMs}
								/>
							</div>

							<Switch
								checked={config.jobs.enableAutoTagging}
								onChange={(checked) =>
									setConfig("jobs", "enableAutoTagging", checked)
								}
							>
								<SwitchControl>
									<SwitchThumb />
								</SwitchControl>
								<SwitchLabel>Enable Auto Tagging</SwitchLabel>
							</Switch>
						</div>
					</TabsContent>

					<TabsContent value="ai">
						<div class="space-y-4 rounded-md border p-4">
							<h2 class="mb-4 font-semibold text-xl">AI Service</h2>
							<div class="space-y-2">
								<Label for="ai-base-url">Base URL</Label>
								<Input
									id="ai-base-url"
									onInput={(event) =>
										setConfig("ai", "baseUrl", event.currentTarget.value)
									}
									value={config.ai.baseUrl}
								/>
							</div>
							<div class="space-y-2">
								<Label for="ai-timeout">Timeout (ms)</Label>
								<Input
									id="ai-timeout"
									onInput={(event) =>
										setConfig(
											"ai",
											"timeoutMs",
											Number(event.currentTarget.value),
										)
									}
									type="number"
									value={config.ai.timeoutMs}
								/>
							</div>
						</div>
					</TabsContent>

					<TabsContent value="downloads">
						<div class="space-y-4 rounded-md border p-4">
							<h2 class="mb-4 font-semibold text-xl">Downloads</h2>
							<Switch
								checked={config.downloads.rateLimitEnabled}
								onChange={(checked) =>
									setConfig("downloads", "rateLimitEnabled", checked)
								}
							>
								<SwitchControl>
									<SwitchThumb />
								</SwitchControl>
								<SwitchLabel>レートリミット有効</SwitchLabel>
							</Switch>
							<div class="space-y-2">
								<Label for="downloads-request-interval">
									リクエスト間隔 (ms)
								</Label>
								<Input
									id="downloads-request-interval"
									onInput={(event) =>
										setConfig(
											"downloads",
											"requestIntervalMs",
											Number(event.currentTarget.value),
										)
									}
									type="number"
									value={config.downloads.requestIntervalMs}
								/>
							</div>
						</div>
					</TabsContent>

					<TabsContent value="storage">
						<div class="space-y-4 rounded-md border p-4">
							<h2 class="mb-4 font-semibold text-xl">Storage</h2>
							<div class="space-y-2">
								<Label for="storage-thumbnail-dir">Thumbnail Directory</Label>
								<Input
									id="storage-thumbnail-dir"
									onInput={(event) =>
										setConfig(
											"storage",
											"thumbnailDir",
											event.currentTarget.value,
										)
									}
									value={config.storage.thumbnailDir}
								/>
							</div>

							<div class="grid grid-cols-2 gap-4">
								<div class="space-y-2">
									<Label for="storage-thumbnail-size">
										Thumbnail Size (px)
									</Label>
									<Input
										id="storage-thumbnail-size"
										onInput={(event) =>
											setConfig(
												"storage",
												"thumbnailSize",
												Number(event.currentTarget.value),
											)
										}
										type="number"
										value={config.storage.thumbnailSize}
									/>
								</div>
								<div class="space-y-2">
									<Label for="storage-thumbnail-quality">
										Thumbnail Quality (1-100)
									</Label>
									<Input
										id="storage-thumbnail-quality"
										onInput={(event) =>
											setConfig(
												"storage",
												"thumbnailQuality",
												Number(event.currentTarget.value),
											)
										}
										type="number"
										value={config.storage.thumbnailQuality}
									/>
								</div>
							</div>
						</div>
					</TabsContent>

					<TabsContent value="media">
						<div class="space-y-4 rounded-md border p-4">
							<h2 class="mb-4 font-semibold text-xl">Media Extensions</h2>

							<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
								<div class="space-y-2">
									<Label for="media-ext-image">Image Extensions</Label>
									<Textarea
										id="media-ext-image"
										onInput={(event) =>
											setConfig(
												"media",
												"supportedExtensions",
												"image",
												parseList(event.currentTarget.value),
											)
										}
										value={config.media.supportedExtensions.image.join(", ")}
									/>
									<div class="text-muted-foreground text-xs">
										Comma separated
									</div>
								</div>
								<div class="space-y-2">
									<Label for="media-ext-video">Video Extensions</Label>
									<Textarea
										id="media-ext-video"
										onInput={(event) =>
											setConfig(
												"media",
												"supportedExtensions",
												"video",
												parseList(event.currentTarget.value),
											)
										}
										value={config.media.supportedExtensions.video.join(", ")}
									/>
								</div>
								<div class="space-y-2">
									<Label for="media-ext-audio">Audio Extensions</Label>
									<Textarea
										id="media-ext-audio"
										onInput={(event) =>
											setConfig(
												"media",
												"supportedExtensions",
												"audio",
												parseList(event.currentTarget.value),
											)
										}
										value={config.media.supportedExtensions.audio.join(", ")}
									/>
								</div>
							</div>

							<h3 class="mt-6 mb-2 font-semibold text-lg">
								Tag Extraction (ComfyUI)
							</h3>
							<div class="space-y-2">
								<Label for="media-positive-node-types">
									Positive Node Types
								</Label>
								<Textarea
									id="media-positive-node-types"
									onInput={(event) =>
										setConfig(
											"media",
											"tagExtraction",
											"comfyui",
											"positiveNodeTypes",
											parseList(event.currentTarget.value),
										)
									}
									value={config.media.tagExtraction.comfyui.positiveNodeTypes.join(
										", ",
									)}
								/>
							</div>
							<div class="space-y-2">
								<Label for="media-negative-keywords">Negative Keywords</Label>
								<Textarea
									id="media-negative-keywords"
									onInput={(event) =>
										setConfig(
											"media",
											"tagExtraction",
											"comfyui",
											"negativeKeywords",
											parseList(event.currentTarget.value),
										)
									}
									value={config.media.tagExtraction.comfyui.negativeKeywords.join(
										", ",
									)}
								/>
							</div>
							<div class="space-y-2">
								<Label for="media-negative-tags">Negative Tags</Label>
								<Textarea
									id="media-negative-tags"
									onInput={(event) =>
										setConfig(
											"media",
											"tagExtraction",
											"comfyui",
											"negativeTags",
											parseList(event.currentTarget.value),
										)
									}
									value={config.media.tagExtraction.comfyui.negativeTags.join(
										", ",
									)}
								/>
							</div>
						</div>
					</TabsContent>

					<TabsContent value="logging">
						<div class="space-y-4 rounded-md border p-4">
							<h2 class="mb-4 font-semibold text-xl">Logging</h2>
							<div class="space-y-2">
								<Label for="logging-level">Log Level</Label>
								<select
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									id="logging-level"
									onInput={(event) =>
										setConfig(
											"logging",
											"level",
											event.currentTarget.value as typeof config.logging.level,
										)
									}
									value={config.logging.level}
								>
									<option value="trace">Trace</option>
									<option value="debug">Debug</option>
									<option value="info">Info</option>
									<option value="warn">Warn</option>
									<option value="error">Error</option>
									<option value="fatal">Fatal</option>
								</select>
							</div>
						</div>
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}
