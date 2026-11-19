import { t } from "@solid-imager/i18n";
import { Alert, AlertDescription } from "@solid-imager/ui/alert";
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
	showHeader?: boolean;
};

type HealthCheckState =
	| { status: "checking" }
	| { latencyMs: number; status: "ok" }
	| { message: string; status: "error" };

function readError(error: unknown): string {
	return error instanceof Error
		? error.message
		: t("serverSettingsScreen.failedToSaveServerSettings");
}

function validateUrl(value: string): string | null {
	try {
		const url = new URL(value.trim());
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			return t("serverSettings.httpUrlRequired");
		}
		if (url.username || url.password) {
			return t("serverSettings.noEmbeddedCredentials");
		}
		return null;
	} catch {
		return t("serverSettings.completeUrlRequired");
	}
}

function healthStatusClass(state: HealthCheckState): string {
	switch (state.status) {
		case "ok":
			return "text-success-foreground text-sm";
		case "checking":
			return "text-muted-foreground text-sm";
		case "error":
			return "text-destructive text-sm";
	}
}

function healthStatusMessage(state: HealthCheckState): string {
	switch (state.status) {
		case "ok":
			return t("serverSettings.healthy", { latency: state.latencyMs });
		case "checking":
			return t("status.checking");
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
	const hasSavedServers = () => localSettings().servers.length > 0;
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
						: t("serverSettingsScreen.unableToReachTheServer"),
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
		if (isSaving()) return;
		setError(null);
		const trimmedName = name().trim();
		if (!trimmedName) {
			setError(t("serverSettingsScreen.enterANameForThisServer"));
			return;
		}
		if (trimmedName.length > 100) {
			setError(t("serverSettingsScreen.serverNamesMustBe100CharactersOrFewer"));
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
				const wasActive = localSettings().activeServerId === currentEditingId;
				const updatedServer = await updateServerConnection({
					baseUrl: baseUrl().trim(),
					id: currentEditingId,
					name: trimmedName,
				});
				if (wasActive) {
					await props.onActivate?.(updatedServer);
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
		<section
			class="grid min-w-0 gap-4"
			classList={{ "px-4 py-6 sm:px-6": props.showHeader !== false }}
		>
			<Show when={props.showHeader !== false}>
				<header class="space-y-1 border-primary border-s-2 ps-3">
					<h1 class="font-semibold text-xl tracking-tight">
						{t("servers.serverConnections")}
					</h1>
					<p class="text-muted-foreground text-sm">
						{t(
							"serverSettingsScreen.chooseWhichSolidImagerServerTheTauriAppUses",
						)}
					</p>
				</header>
			</Show>

			<Show when={error()}>
				{(message) => (
					<Alert variant="destructive">
						<AlertDescription>{message()}</AlertDescription>
					</Alert>
				)}
			</Show>

			<div
				class="grid items-start gap-4"
				classList={{ "lg:grid-cols-server-settings": hasSavedServers() }}
			>
				<Show when={hasSavedServers()}>
					<Card class="@container min-w-0">
						<CardHeader>
							<CardTitle>{t("serverSettingsScreen.savedServers")}</CardTitle>
							<CardDescription>
								{t(
									"serverSettingsScreen.theActiveServerIsUsedForAPIRequestsThumbnails",
								)}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div class="divide-y divide-border border-border border-t">
								<For each={localSettings().servers}>
									{(server) => (
										<div class="grid gap-3 py-3 text-sm last:pb-0 @xl:grid-cols-content-action @xl:items-center">
											<div class="min-w-0">
												<div class="flex flex-wrap items-center gap-2">
													<span class="min-w-0 wrap-break-word font-medium">
														{server.name}
													</span>
													<Show
														when={localSettings().activeServerId === server.id}
													>
														<Badge>{t("jobsScreen.active")}</Badge>
													</Show>
												</div>
												<p class="mt-1 break-all text-muted-foreground">
													{server.baseUrl}
												</p>
												<HealthStatus state={() => healthChecks()[server.id]} />
											</div>
											<div class="flex flex-wrap gap-2 @xl:justify-end">
												<Button
													disabled={isSaving() || isChecking()}
													onClick={() =>
														void runHealthCheck(server.id, server.baseUrl)
													}
													class="h-11 sm:h-9"
													size="sm"
													variant="outline"
												>
													{t("select.check")}
												</Button>
												<Show
													when={localSettings().activeServerId !== server.id}
												>
													<Button
														disabled={isSaving() || isChecking()}
														onClick={() => void selectServer(server.id)}
														class="h-11 sm:h-9"
														size="sm"
													>
														{t("serverSettingsScreen.useServer")}
													</Button>
												</Show>
												<Button
													disabled={isSaving() || isChecking()}
													onClick={() => beginEdit(server)}
													variant="outline"
													class="h-11 sm:h-9"
													size="sm"
												>
													{t("actions.edit")}
												</Button>
												<Button
													disabled={isSaving() || isChecking()}
													onClick={() => void deleteServer(server.id)}
													class="h-11 sm:h-9"
													size="sm"
													variant="destructive"
												>
													{t("actions.delete")}
												</Button>
											</div>
										</div>
									)}
								</For>
							</div>
						</CardContent>
					</Card>
				</Show>
				<Card class="@container min-w-0">
					<CardHeader>
						<CardTitle>
							{editingId()
								? t("serverSettingsScreen.editServer")
								: t("serverSettingsScreen.addServer")}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<form
							class="grid grid-cols-1 items-start gap-4 @xl:grid-cols-2"
							onSubmit={(event) => void submit(event)}
						>
							<div class="grid min-w-0 gap-2">
								<Label for="server-name">{t("labels.name")}</Label>
								<Input
									autocomplete="off"
									class="sm:min-h-9"
									id="server-name"
									onInput={(event) => {
										setName(event.currentTarget.value);
										setHealthCheck("form", undefined);
									}}
									placeholder={t("serverSettingsScreen.homeServer")}
									value={name()}
								/>
							</div>
							<div class="grid min-w-0 gap-2">
								<Label for="server-url">
									{t("serverSettingsScreen.serverURL")}
								</Label>
								<Input
									aria-describedby="server-url-help"
									autocomplete="url"
									class="sm:min-h-9"
									id="server-url"
									onInput={(event) => {
										setBaseUrl(event.currentTarget.value);
										setHealthCheck("form", undefined);
									}}
									placeholder={t("serverSettingsScreen.httpsImagerExampleCom")}
									value={baseUrl()}
								/>
								<p class="text-muted-foreground text-xs" id="server-url-help">
									{t(
										"serverSettingsScreen.useTheServerOriginIncludingItsPortWhenOne",
									)}
								</p>
							</div>
							<div class="col-span-full flex flex-wrap items-center gap-2 border-border border-t pt-4">
								<Button
									class="sm:h-9"
									disabled={isSaving() || isChecking()}
									onClick={() => void runHealthCheck("form", baseUrl())}
									type="button"
									variant="outline"
								>
									{t("serverSettingsScreen.checkConnection")}
								</Button>
								<Button
									class="sm:h-9"
									disabled={isSaving() || isChecking()}
									type="submit"
								>
									{editingId()
										? t("actions.saveChanges")
										: t("serverSettingsScreen.addServer")}
								</Button>
								<Show when={editingId()}>
									<Button
										class="sm:h-9"
										onClick={resetForm}
										type="button"
										variant="outline"
									>
										{t("actions.cancel")}
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
