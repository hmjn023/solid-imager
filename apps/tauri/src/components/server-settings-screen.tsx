import { Badge } from "@solid-imager/ui/badge";
import { Button } from "@solid-imager/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
import { Input } from "@solid-imager/ui/input";
import { Label } from "@solid-imager/ui/label";
import { createSignal, For, Show } from "solid-js";
import { checkServerHealth } from "~/infrastructure/settings/server-health";
import {
	activateServer,
	addServerConnection,
	getServerSettings,
	removeServerConnection,
	type ServerConnection,
	type ServerSettings,
	updateServerConnection,
} from "~/infrastructure/settings/server-settings";

type ServerSettingsScreenProps = {
	initialSettings: ServerSettings;
	onActivate?: (server: ServerConnection) => Promise<void>;
	onNoActiveServer?: () => Promise<void>;
};

type HealthCheckState =
	| { status: "checking" }
	| { latencyMs: number; status: "ok" }
	| { message: string; status: "error" };

function readError(error: unknown): string {
	return error instanceof Error
		? error.message
		: "Failed to save server settings.";
}

function validateUrl(value: string): string | null {
	try {
		const url = new URL(value.trim());
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			return "Use an http:// or https:// URL.";
		}
		if (url.username || url.password) {
			return "Credentials must not be embedded in the URL.";
		}
		return null;
	} catch {
		return "Enter a complete server URL, for example https://imager.example.com.";
	}
}

function healthStatusClass(state: HealthCheckState): string {
	switch (state.status) {
		case "ok":
			return "text-emerald-700 text-sm";
		case "checking":
			return "text-muted-foreground text-sm";
		case "error":
			return "text-destructive text-sm";
	}
}

function healthStatusMessage(state: HealthCheckState): string {
	switch (state.status) {
		case "ok":
			return `Healthy (${state.latencyMs} ms)`;
		case "checking":
			return "Checking…";
		case "error":
			return state.message;
	}
}

function HealthStatus(props: { state: () => HealthCheckState | undefined }) {
	return (
		<Show when={props.state()}>
			{(state) => (
				<span aria-live="polite" class={healthStatusClass(state())}>
					{healthStatusMessage(state())}
				</span>
			)}
		</Show>
	);
}

export function ServerSettingsScreen(props: ServerSettingsScreenProps) {
	const [localSettings, setLocalSettings] = createSignal(props.initialSettings);
	const [editingId, setEditingId] = createSignal<string | null>(null);
	const [name, setName] = createSignal("");
	const [baseUrl, setBaseUrl] = createSignal("");
	const [error, setError] = createSignal<string | null>(null);
	const [isSaving, setIsSaving] = createSignal(false);
	const [isChecking, setIsChecking] = createSignal(false);
	const [healthChecks, setHealthChecks] = createSignal<
		Record<string, HealthCheckState>
	>({});

	const setHealthCheck = (key: string, state: HealthCheckState | undefined) => {
		setHealthChecks((current) => {
			const next = { ...current };
			if (state) {
				next[key] = state;
			} else {
				delete next[key];
			}
			return next;
		});
	};

	const runHealthCheck = async (key: string, url: string) => {
		const urlError = validateUrl(url);
		if (urlError) {
			setHealthCheck(key, { message: urlError, status: "error" });
			return;
		}

		setError(null);
		setHealthCheck(key, { status: "checking" });
		setIsChecking(true);
		try {
			const result = await checkServerHealth(url);
			setHealthCheck(key, {
				latencyMs: result.latencyMs,
				status: "ok",
			});
		} catch (healthError) {
			setHealthCheck(key, {
				message:
					healthError instanceof Error
						? healthError.message
						: "Unable to reach the server.",
				status: "error",
			});
		} finally {
			setIsChecking(false);
		}
	};

	const resetForm = () => {
		setEditingId(null);
		setName("");
		setBaseUrl("");
		setError(null);
		setHealthCheck("form", undefined);
	};

	const refreshSettings = () => {
		setLocalSettings({ ...getServerSettings() });
	};

	const beginEdit = (server: ServerConnection) => {
		setEditingId(server.id);
		setName(server.name);
		setBaseUrl(server.baseUrl);
		setError(null);
		setHealthCheck("form", undefined);
	};

	const submit = async (event: SubmitEvent) => {
		event.preventDefault();
		setError(null);
		const trimmedName = name().trim();
		if (!trimmedName) {
			setError("Enter a name for this server.");
			return;
		}
		const urlError = validateUrl(baseUrl());
		if (urlError) {
			setError(urlError);
			return;
		}

		setIsSaving(true);
		try {
			const currentEditingId = editingId();
			if (currentEditingId) {
				await updateServerConnection({
					baseUrl: baseUrl().trim(),
					id: currentEditingId,
					name: trimmedName,
				});
				if (localSettings().activeServerId === currentEditingId) {
					const updatedServer = getServerSettings().servers.find(
						(server) => server.id === currentEditingId,
					);
					if (updatedServer) {
						await props.onActivate?.(updatedServer);
					}
				}
			} else {
				const server = await addServerConnection({
					baseUrl: baseUrl().trim(),
					name: trimmedName,
				});
				// A newly entered endpoint is the user's explicit selection. Activate
				// it immediately so adding a server cannot leave the app pointed at
				// the build-time default by accident.
				await activateServer(server.id);
				await props.onActivate?.(server);
			}
			refreshSettings();
			resetForm();
		} catch (submitError) {
			setError(readError(submitError));
		} finally {
			setIsSaving(false);
		}
	};

	const selectServer = async (id: string) => {
		setError(null);
		setIsSaving(true);
		try {
			const wasActive = localSettings().activeServerId === id;
			const server = await activateServer(id);
			refreshSettings();
			if (!wasActive) {
				await props.onActivate?.(server);
			}
		} catch (selectionError) {
			setError(readError(selectionError));
		} finally {
			setIsSaving(false);
		}
	};

	const deleteServer = async (id: string) => {
		setError(null);
		setIsSaving(true);
		try {
			const wasActive = localSettings().activeServerId === id;
			await removeServerConnection(id);
			refreshSettings();
			if (editingId() === id) {
				resetForm();
			}
			if (wasActive) {
				const nextServer = getServerSettings().activeServerId
					? getServerSettings().servers.find(
							(server) => server.id === getServerSettings().activeServerId,
						)
					: null;
				if (nextServer) {
					await props.onActivate?.(nextServer);
				} else {
					await props.onNoActiveServer?.();
				}
			}
		} catch (deleteError) {
			setError(readError(deleteError));
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<section class="grid gap-6">
			<div class="grid gap-2">
				<Badge class="w-fit" variant="outline">
					Connection
				</Badge>
				<h1 class="font-semibold text-4xl tracking-tight">
					Server connections
				</h1>
				<p class="max-w-3xl text-lg text-muted-foreground">
					Choose which solid-imager server the Tauri app uses. These connections
					are stored locally on this device and are independent of server-side
					settings.
				</p>
			</div>

			<Show when={error()}>
				{(message) => (
					<div class="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive text-sm">
						{message()}
					</div>
				)}
			</Show>

			<div class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
				<Card>
					<CardHeader>
						<CardTitle>Saved servers</CardTitle>
						<CardDescription>
							The active server is used for API requests, thumbnails, and future
							sync jobs. Adding a server activates it immediately.
						</CardDescription>
					</CardHeader>
					<CardContent class="grid gap-3">
						<Show
							fallback={
								<p class="rounded-lg border border-dashed px-4 py-6 text-muted-foreground text-sm">
									No server has been added yet.
								</p>
							}
							when={localSettings().servers.length > 0}
						>
							<div class="grid gap-3">
								<For each={localSettings().servers}>
									{(server) => (
										<div class="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto] sm:items-center">
											<div class="min-w-0">
												<div class="flex flex-wrap items-center gap-2">
													<span class="font-medium">{server.name}</span>
													<Show
														when={localSettings().activeServerId === server.id}
													>
														<Badge variant="secondary">Active</Badge>
													</Show>
												</div>
												<p class="mt-1 truncate text-muted-foreground text-sm">
													{server.baseUrl}
												</p>
												<HealthStatus state={() => healthChecks()[server.id]} />
											</div>
											<div class="flex flex-wrap gap-2 sm:justify-end">
												<Button
													disabled={isSaving() || isChecking()}
													onClick={() =>
														void runHealthCheck(server.id, server.baseUrl)
													}
													size="sm"
													variant="outline"
												>
													Check
												</Button>
												<Show
													when={localSettings().activeServerId !== server.id}
												>
													<Button
														disabled={isSaving() || isChecking()}
														onClick={() => void selectServer(server.id)}
														size="sm"
													>
														Use server
													</Button>
												</Show>
												<Button
													disabled={isSaving() || isChecking()}
													onClick={() => beginEdit(server)}
													variant="outline"
													size="sm"
												>
													Edit
												</Button>
												<Button
													disabled={isSaving() || isChecking()}
													onClick={() => void deleteServer(server.id)}
													size="sm"
													variant="destructive"
												>
													Delete
												</Button>
											</div>
										</div>
									)}
								</For>
							</div>
						</Show>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>{editingId() ? "Edit server" : "Add server"}</CardTitle>
						<CardDescription>
							Use the server origin, including its port when one is configured.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form class="grid gap-4" onSubmit={(event) => void submit(event)}>
							<div class="grid gap-2">
								<Label for="server-name">Name</Label>
								<Input
									autocomplete="off"
									id="server-name"
									onInput={(event) => {
										setName(event.currentTarget.value);
										setHealthCheck("form", undefined);
									}}
									placeholder="Home server"
									value={name()}
								/>
							</div>
							<div class="grid gap-2">
								<Label for="server-url">Server URL</Label>
								<Input
									autocomplete="url"
									id="server-url"
									onInput={(event) => {
										setBaseUrl(event.currentTarget.value);
										setHealthCheck("form", undefined);
									}}
									placeholder="https://imager.example.com"
									value={baseUrl()}
								/>
							</div>
							<div class="flex flex-wrap gap-2">
								<Button
									disabled={isSaving() || isChecking()}
									onClick={() => void runHealthCheck("form", baseUrl())}
									type="button"
									variant="outline"
								>
									Check connection
								</Button>
								<Button disabled={isSaving() || isChecking()} type="submit">
									{editingId() ? "Save changes" : "Add server"}
								</Button>
								<Show when={editingId()}>
									<Button onClick={resetForm} type="button" variant="outline">
										Cancel
									</Button>
								</Show>
								<HealthStatus state={() => healthChecks().form} />
							</div>
						</form>
					</CardContent>
				</Card>
			</div>
		</section>
	);
}
