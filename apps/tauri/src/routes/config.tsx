import { Button } from "@solid-imager/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
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
import { toast } from "@solid-imager/ui/toast";
import { createFileRoute } from "@tanstack/solid-router";
import { createStore } from "solid-js/store";
import { mockConfig } from "../mocks/demo-data";

export const Route = createFileRoute("/config")({
	component: ConfigRoute,
});

function ConfigRoute() {
	const [config, setConfig] = createStore(structuredClone(mockConfig));

	return (
		<section class="grid gap-6">
			<div class="flex items-center justify-between gap-4">
				<div class="grid gap-2">
					<h1 class="font-semibold text-4xl tracking-tight">Settings</h1>
					<p class="text-muted-foreground">
						`apps/server/src/routes/config.tsx` の構成に寄せたローカル編集 UI
						です。保存は mock toast のみ返します。
					</p>
				</div>
				<Button onClick={() => toast.success("Saved local config preview")}>
					Save Changes
				</Button>
			</div>

			<Tabs class="grid gap-4" defaultValue="jobs">
				<TabsList class="grid h-auto grid-cols-2 gap-2 p-1 md:grid-cols-5">
					<TabsTrigger value="jobs">Jobs</TabsTrigger>
					<TabsTrigger value="ai">AI</TabsTrigger>
					<TabsTrigger value="downloads">Downloads</TabsTrigger>
					<TabsTrigger value="storage">Storage</TabsTrigger>
					<TabsTrigger value="logging">Logging</TabsTrigger>
				</TabsList>

				<TabsContent value="jobs">
					<Card>
						<CardHeader>
							<CardTitle>Job Processing</CardTitle>
						</CardHeader>
						<CardContent class="grid gap-4 md:grid-cols-3">
							<div class="grid gap-2">
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
							</div>
							<div class="grid gap-2">
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
							</div>
							<div class="grid gap-2">
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
							<div class="md:col-span-3">
								<Switch
									checked={config.jobs.enableAutoTagging}
									onChange={(checked) =>
										setConfig("jobs", "enableAutoTagging", checked)
									}
								>
									<div class="flex items-center gap-3">
										<SwitchControl>
											<SwitchThumb />
										</SwitchControl>
										<SwitchLabel>Enable Auto Tagging</SwitchLabel>
									</div>
								</Switch>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="ai">
					<Card>
						<CardHeader>
							<CardTitle>AI Service</CardTitle>
						</CardHeader>
						<CardContent class="grid gap-4 md:grid-cols-2">
							<div class="grid gap-2">
								<Label for="ai-base-url">Base URL</Label>
								<Input
									id="ai-base-url"
									onInput={(event) =>
										setConfig("ai", "baseUrl", event.currentTarget.value)
									}
									value={config.ai.baseUrl}
								/>
							</div>
							<div class="grid gap-2">
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
							<Switch
								checked={config.ai.autoAnalyzePrompt}
								onChange={(checked) =>
									setConfig("ai", "autoAnalyzePrompt", checked)
								}
							>
								<div class="flex items-center gap-3">
									<SwitchControl>
										<SwitchThumb />
									</SwitchControl>
									<SwitchLabel>Auto analyze prompts after import</SwitchLabel>
								</div>
							</Switch>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="downloads">
					<Card>
						<CardHeader>
							<CardTitle>Downloads</CardTitle>
						</CardHeader>
						<CardContent class="grid gap-4 md:grid-cols-2">
							<Switch
								checked={config.downloads.rateLimitEnabled}
								onChange={(checked) =>
									setConfig("downloads", "rateLimitEnabled", checked)
								}
							>
								<div class="flex items-center gap-3">
									<SwitchControl>
										<SwitchThumb />
									</SwitchControl>
									<SwitchLabel>Enable request throttling</SwitchLabel>
								</div>
							</Switch>
							<div class="grid gap-2">
								<Label for="request-interval">Request Interval (ms)</Label>
								<Input
									id="request-interval"
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
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="storage">
					<Card>
						<CardHeader>
							<CardTitle>Storage</CardTitle>
						</CardHeader>
						<CardContent class="grid gap-4 md:grid-cols-2">
							<div class="grid gap-2 md:col-span-2">
								<Label for="thumbnail-dir">Thumbnail Directory</Label>
								<Input
									id="thumbnail-dir"
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
							<div class="grid gap-2">
								<Label for="thumbnail-size">Thumbnail Size</Label>
								<Input
									id="thumbnail-size"
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
							<div class="grid gap-2">
								<Label for="original-dir">Original Directory</Label>
								<Input
									id="original-dir"
									onInput={(event) =>
										setConfig(
											"storage",
											"originalDir",
											event.currentTarget.value,
										)
									}
									value={config.storage.originalDir}
								/>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="logging">
					<Card>
						<CardHeader>
							<CardTitle>Logging</CardTitle>
						</CardHeader>
						<CardContent class="grid gap-4 md:grid-cols-2">
							<div class="grid gap-2">
								<Label for="log-level">Level</Label>
								<Input
									id="log-level"
									onInput={(event) =>
										setConfig(
											"logging",
											"level",
											event.currentTarget.value as "debug" | "info" | "warn",
										)
									}
									value={config.logging.level}
								/>
							</div>
							<div class="grid gap-2">
								<Label for="retention-days">Retention Days</Label>
								<Input
									id="retention-days"
									onInput={(event) =>
										setConfig(
											"logging",
											"retentionDays",
											Number(event.currentTarget.value),
										)
									}
									type="number"
									value={config.logging.retentionDays}
								/>
							</div>
							<Switch
								checked={config.logging.enableConsoleMirror}
								onChange={(checked) =>
									setConfig("logging", "enableConsoleMirror", checked)
								}
							>
								<div class="flex items-center gap-3">
									<SwitchControl>
										<SwitchThumb />
									</SwitchControl>
									<SwitchLabel>Mirror logs to console</SwitchLabel>
								</div>
							</Switch>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</section>
	);
}
