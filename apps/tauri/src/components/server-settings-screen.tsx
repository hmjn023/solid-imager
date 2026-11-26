import { cn } from "@solid-imager/ui/utils";
import { t } from "@solid-imager/i18n";
import { Alert, AlertDescription } from "@solid-imager/ui/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@solid-imager/ui/alert-dialog";
import { Badge } from "@solid-imager/ui/badge";
import { Button } from "@solid-imager/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
import { FormFieldMessage } from "@solid-imager/ui/form-message";
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
	const [nameError, setNameError] = createSignal<string | undefined>();
	const [urlError, setUrlError] = createSignal<string | undefined>();
	const [error, setError] = createSignal<string | null>(null);
	const [isSaving, setIsSaving] = createSignal(false);
	const [pendingDeleteServer, setPendingDeleteServer] =
		createSignal<ServerConnection | null>(null);
	const [healthChecks, setHealthChecks] = createSignal<
		Record<string, HealthCheckState>
	>({});
	let nameInputRef: HTMLInputElement | undefined;
	let urlInputRef: HTMLInputElement | undefined;
	const isCheckingKey = (key: string) =>
		healthChecks()[key]?.status === "checking";

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
		const validationError = validateUrl(url);
		if (validationError) {
			if (key === "form") {
				setUrlError(validationError);
			}
			setHealthCheck(key, { message: validationError, status: "error" });
			return;
		}
		if (key === "form") {
			setUrlError(undefined);
		}

		setError(null);
		setHealthCheck(key, { status: "checking" });
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
		}
	};

	const resetForm = () => {
		setEditingId(null);
		setName("");
		setBaseUrl("");
		setNameError(undefined);
		setUrlError(undefined);
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
		setNameError(undefined);
		setUrlError(undefined);
		setError(null);
		setHealthCheck("form", undefined);
		queueMicrotask(() => {
			nameInputRef?.focus();
			nameInputRef?.select();
		});
	};

	const submit = async (event: SubmitEvent) => {
		event.preventDefault();
		if (isSaving()) return;
		setError(null);
		setNameError(undefined);
		setUrlError(undefined);
		const trimmedName = name().trim();
		if (!trimmedName) {
			setNameError(t("serverSettingsScreen.enterANameForThisServer"));
			nameInputRef?.focus();
			return;
		}
		if (trimmedName.length > 100) {
			setNameError(
				t("serverSettingsScreen.serverNamesMustBe100CharactersOrFewer"),
			);
			nameInputRef?.focus();
			return;
		}
		const validationError = validateUrl(baseUrl());
		if (validationError) {
			setUrlError(validationError);
			urlInputRef?.focus();
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
				refreshSettings();
				if (wasActive) {
					await props.onActivate?.(updatedServer);
				}
			} else {
				const server = await addServerConnection({
					baseUrl: baseUrl().trim(),
					name: trimmedName,
				});
				refreshSettings();
				setEditingId(server.id);
				// A newly entered endpoint is the user's explicit selection. Activate
				// it immediately so adding a server cannot leave the app pointed at
				// the build-time default by accident.
				await activateServer(server.id);
				refreshSettings();
				await props.onActivate?.(server);
			}
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
			class={cn("grid min-w-0 gap-4", {
				"px-4 py-6 sm:px-6": props.showHeader !== false,
			})}
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
				class={cn("grid items-start gap-4", {
					"lg:grid-cols-server-settings": hasSavedServers(),
				})}
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
										<div
											class={cn(
												"grid gap-3 py-3 text-sm transition-colors last:pb-0 @xl:grid-cols-content-action @xl:items-center",
												{
													"rounded-md bg-accent/50 px-3":
														editingId() === server.id,
												},
											)}
										>
											<div class="min-w-0">
												<div class="flex flex-wrap items-center gap-2">
													<span class="min-w-0 wrap-break-word font-medium">
														{server.name}
													</span>
													<Show
														when={localSettings().activeServerId === server.id}
													>
														<Badge>
															{t("serverSettingsScreen.activeBadge")}
														</Badge>
													</Show>
													<Show when={editingId() === server.id}>
														<Badge variant="outline">
															{t("serverSettingsScreen.editingBadge")}
														</Badge>
													</Show>
												</div>
												<p class="mt-1 break-all text-muted-foreground">
													{server.baseUrl}
												</p>
												<HealthStatus state={() => healthChecks()[server.id]} />
											</div>
											<div class="flex flex-wrap gap-2 @xl:justify-end">
												<Button
													aria-busy={
														isCheckingKey(server.id) ? "true" : "false"
													}
													disabled={isSaving() || isCheckingKey(server.id)}
													onClick={() =>
														void runHealthCheck(server.id, server.baseUrl)
													}
													class="h-11 sm:h-9"
													size="sm"
													variant="outline"
												>
													{t("serverSettingsScreen.checkStatus")}
												</Button>
												<Show
													when={localSettings().activeServerId !== server.id}
												>
													<Button
														disabled={isSaving()}
														onClick={() => void selectServer(server.id)}
														class="h-11 sm:h-9"
														size="sm"
													>
														{t("serverSettingsScreen.useServer")}
													</Button>
												</Show>
												<Button
													disabled={isSaving()}
													onClick={() => beginEdit(server)}
													variant="outline"
													class="h-11 sm:h-9"
													size="sm"
												>
													{t("actions.edit")}
												</Button>
												<Button
													disabled={isSaving()}
													onClick={() => setPendingDeleteServer(server)}
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
									aria-describedby={
										nameError() ? "server-name-error" : undefined
									}
									aria-invalid={nameError() ? "true" : undefined}
									autocomplete="off"
									class="sm:min-h-9"
									id="server-name"
									onInput={(event) => {
										setName(event.currentTarget.value);
										setNameError(undefined);
										setHealthCheck("form", undefined);
									}}
									placeholder={t("serverSettingsScreen.homeServer")}
									ref={(el) => {
										nameInputRef = el;
									}}
									value={name()}
								/>
								<FormFieldMessage
									id="server-name-error"
									message={nameError()}
								/>
							</div>
							<div class="grid min-w-0 gap-2">
								<Label for="server-url">
									{t("serverSettingsScreen.serverURL")}
								</Label>
								<Input
									aria-describedby={
										urlError()
											? "server-url-error server-url-help"
											: "server-url-help"
									}
									aria-invalid={urlError() ? "true" : undefined}
									autocomplete="url"
									class="sm:min-h-9"
									id="server-url"
									onInput={(event) => {
										setBaseUrl(event.currentTarget.value);
										setUrlError(undefined);
										setHealthCheck("form", undefined);
									}}
									placeholder={t("serverSettingsScreen.httpsImagerExampleCom")}
									ref={(el) => {
										urlInputRef = el;
									}}
									value={baseUrl()}
								/>
								<FormFieldMessage id="server-url-error" message={urlError()} />
								<p class="text-muted-foreground text-xs" id="server-url-help">
									{t(
										"serverSettingsScreen.useTheServerOriginIncludingItsPortWhenOne",
									)}
								</p>
							</div>
							<div class="col-span-full flex flex-wrap items-center gap-2 border-border border-t pt-4">
								<Button
									aria-busy={isCheckingKey("form") ? "true" : "false"}
									class="sm:h-9"
									disabled={isSaving() || isCheckingKey("form")}
									onClick={() => void runHealthCheck("form", baseUrl())}
									type="button"
									variant="outline"
								>
									{t("serverSettingsScreen.checkConnection")}
								</Button>
								<Button
									aria-busy={isSaving() ? "true" : "false"}
									class="sm:h-9"
									disabled={isSaving()}
									type="submit"
								>
									{editingId()
										? t("actions.saveChanges")
										: t("serverSettingsScreen.addServer")}
								</Button>
								<Show when={editingId()}>
									<Button
										class="sm:h-9"
										disabled={isSaving()}
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

			<AlertDialog
				open={Boolean(pendingDeleteServer())}
				onOpenChange={(open) => {
					if (!open && !isSaving()) {
						setPendingDeleteServer(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("serverSettingsScreen.deleteServerTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription class="break-words">
							<Show when={pendingDeleteServer()}>
								{(target) =>
									t("serverSettingsScreen.deleteServerDescription", {
										name: target().name,
										url: target().baseUrl,
									})
								}
							</Show>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isSaving()}>
							{t("actions.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={isSaving()}
							onClick={() => {
								const target = pendingDeleteServer();
								setPendingDeleteServer(null);
								if (target) {
									void deleteServer(target.id);
								}
							}}
							variant="destructive"
						>
							{t("actions.delete")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</section>
	);
}
