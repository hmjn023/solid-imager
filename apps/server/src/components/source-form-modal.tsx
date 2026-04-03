import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type {
	MediaSourceInfo,
	MediaSourceTypeEnum,
	SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
import { Button } from "@solid-imager/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@solid-imager/ui/dialog";
import { Input } from "@solid-imager/ui/input";
import { Label } from "@solid-imager/ui/label";
import { createEffect, createSignal, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { z } from "zod";
import type { AppRouter } from "~/domain/shared/api-contract";

const DEFAULT_SFTP_PORT = 22;
const SOURCE_TYPE_OPTIONS: Array<{
	value: MediaSourceTypeEnum;
	label: string;
}> = [
	{ value: "local", label: "Local Filesystem" },
	{ value: "sftp", label: "SFTP" },
	{ value: "s3", label: "S3 Compatible Storage" },
	{ value: "remote", label: "Remote Server" },
];
const REMOTE_SOURCE_ID_SCHEMA = z.uuid();
const REMOTE_URL_SCHEMA = z.string().url();
const NATIVE_SELECT_CLASS =
	"flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

function extractRemoteServerAddress(url: string): string {
	try {
		const parsed = new URL(url);
		const host = parsed.port
			? `${parsed.hostname}:${parsed.port}`
			: parsed.hostname;
		const path = parsed.pathname === "/" ? "" : parsed.pathname;
		return `${host}${path}`;
	} catch {
		return url;
	}
}

function normalizeRemoteServerUrl(address: string): string {
	const trimmed = address.trim();
	if (!trimmed) {
		return "";
	}
	const withProtocol = /^[a-z]+:\/\//i.test(trimmed)
		? trimmed
		: `http://${trimmed}`;
	const parsed = new URL(withProtocol);
	parsed.search = "";
	parsed.hash = "";
	parsed.pathname =
		parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "");
	return parsed.toString();
}

function createRemoteClient(baseUrl: string): RouterClient<AppRouter> {
	const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
	const link = new RPCLink({
		url: new URL("api/rpc", normalizedBaseUrl).toString(),
		fetch,
	});
	return createORPCClient(link) as RouterClient<AppRouter>;
}

type SourceFormModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (data: any) => void;
	editingSource?: MediaSourceInfo | SafeMediaSource | null;
};

export default function SourceFormModal(props: SourceFormModalProps) {
	const [formData, setFormData] = createStore<{
		name: string;
		description: string;
		type: MediaSourceTypeEnum;
		connectionInfo: Record<string, string | number>;
	}>({
		name: "",
		description: "",
		type: "local",
		connectionInfo: {},
	});

	const [errors, setErrors] = createSignal<Record<string, string>>({});
	const [remoteServerAddress, setRemoteServerAddress] = createSignal("");
	const [remoteSourceOptions, setRemoteSourceOptions] = createSignal<
		Array<{ label: string; value: string }>
	>([]);
	const [isLoadingRemoteSources, setIsLoadingRemoteSources] =
		createSignal(false);
	const [remoteSourcesError, setRemoteSourcesError] = createSignal<
		string | null
	>(null);

	const loadRemoteSources = async (address = remoteServerAddress()) => {
		const trimmedAddress = address.trim();
		if (!trimmedAddress) {
			setRemoteSourceOptions([]);
			setRemoteSourcesError("Remote server IP/host is required");
			setFormData("connectionInfo", "url", "");
			setFormData("connectionInfo", "remoteSourceId", "");
			return;
		}

		let normalizedUrl = "";
		try {
			normalizedUrl = normalizeRemoteServerUrl(trimmedAddress);
		} catch {
			setRemoteSourceOptions([]);
			setRemoteSourcesError("Invalid server address");
			setFormData("connectionInfo", "url", trimmedAddress);
			setFormData("connectionInfo", "remoteSourceId", "");
			return;
		}

		setIsLoadingRemoteSources(true);
		setRemoteSourcesError(null);
		setFormData("connectionInfo", "url", normalizedUrl);

		try {
			const client = createRemoteClient(normalizedUrl);
			const sources = await client.sources.list();
			const options = sources
				.filter((source) => source.type === "local" && source.id)
				.map((source) => ({
					label: source.name,
					value: source.id as string,
				}));

			setRemoteSourceOptions(options);

			const selectedRemoteSourceId = formData.connectionInfo.remoteSourceId;
			if (
				!selectedRemoteSourceId ||
				!options.some((option) => option.value === selectedRemoteSourceId)
			) {
				setFormData("connectionInfo", "remoteSourceId", "");
			}

			if (options.length === 0) {
				setRemoteSourcesError("No local sources found on the remote server");
			}
		} catch (error) {
			setRemoteSourceOptions([]);
			setRemoteSourcesError(
				error instanceof Error
					? error.message
					: "Failed to load sources from the remote server",
			);
			setFormData("connectionInfo", "remoteSourceId", "");
		} finally {
			setIsLoadingRemoteSources(false);
		}
	};

	createEffect(() => {
		if (props.editingSource) {
			const connectionInfo = (props.editingSource.connectionInfo as any) || {};
			setFormData({
				name: props.editingSource.name,
				description: props.editingSource.description || "",
				type: props.editingSource.type,
				connectionInfo,
			});
			if (props.editingSource.type === "remote" && connectionInfo.url) {
				const address = extractRemoteServerAddress(connectionInfo.url);
				setRemoteServerAddress(address);
				void loadRemoteSources(address);
			} else {
				setRemoteServerAddress("");
				setRemoteSourceOptions([]);
				setRemoteSourcesError(null);
			}
		} else {
			setFormData({
				name: "",
				description: "",
				type: "local",
				connectionInfo: {},
			});
			setRemoteServerAddress("");
			setRemoteSourceOptions([]);
			setRemoteSourcesError(null);
		}
		setErrors({});
	});

	const validate = () => {
		const newErrors: Record<string, string> = {};
		if (!formData.name.trim()) {
			newErrors.name = "Name is required";
		}

		if (formData.type === "local") {
			if (!formData.connectionInfo.path) {
				newErrors.path = "Path is required";
			}
		} else if (formData.type === "sftp") {
			if (!formData.connectionInfo.host) {
				newErrors.host = "Host is required";
			}
			if (!formData.connectionInfo.username) {
				newErrors.username = "Username is required";
			}
			if (!formData.connectionInfo.remotePath) {
				newErrors.remotePath = "Remote path is required";
			}
		} else if (formData.type === "s3") {
			if (!formData.connectionInfo.bucket) {
				newErrors.bucket = "Bucket is required";
			}
			if (!formData.connectionInfo.region) {
				newErrors.region = "Region is required";
			}
			// AccessKey/SecretKey are optional on edit if not changing
			if (!props.editingSource) {
				if (!formData.connectionInfo.accessKeyId) {
					newErrors.accessKeyId = "Access Key ID is required";
				}
				if (!formData.connectionInfo.secretAccessKey) {
					newErrors.secretAccessKey = "Secret Access Key is required";
				}
			}
		} else if (formData.type === "remote") {
			if (!remoteServerAddress().trim()) {
				newErrors.url = "Remote server IP/host is required";
			} else if (
				!REMOTE_URL_SCHEMA.safeParse(formData.connectionInfo.url).success
			) {
				newErrors.url = "Invalid URL format";
			}
			if (!formData.connectionInfo.remoteSourceId) {
				newErrors.remoteSourceId = "Remote source ID is required";
			} else if (
				!REMOTE_SOURCE_ID_SCHEMA.safeParse(
					formData.connectionInfo.remoteSourceId,
				).success
			) {
				newErrors.remoteSourceId = "Invalid UUID format";
			}
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		if (validate()) {
			props.onSubmit({
				...formData,
				description: formData.description || null,
				connectionInfo: {
					...formData.connectionInfo,
					// Ensure port is number for SFTP
					port: formData.connectionInfo.port
						? Number(formData.connectionInfo.port)
						: undefined,
				},
			});
		}
	};

	return (
		<Dialog onOpenChange={() => props.onClose()} open={props.isOpen}>
			<DialogContent class="max-h-[80vh] overflow-y-auto sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>
						{props.editingSource ? "Edit Source" : "Add New Source"}
					</DialogTitle>
					<DialogDescription>
						Configure the connection details for your media source.
					</DialogDescription>
				</DialogHeader>

				<form class="space-y-4" onSubmit={handleSubmit}>
					<div class="space-y-2">
						<Label for="name">Name</Label>
						<Input
							id="name"
							onInput={(e) => setFormData("name", e.currentTarget.value)}
							placeholder="My Media Source"
							value={formData.name}
						/>
						<Show when={errors().name}>
							<p class="text-red-500 text-sm">{errors().name}</p>
						</Show>
					</div>

					<div class="space-y-2">
						<Label for="description">Description (Optional)</Label>
						<Input
							id="description"
							onInput={(e) => setFormData("description", e.currentTarget.value)}
							placeholder="Photos from my camera"
							value={formData.description}
						/>
					</div>

					<div class="space-y-2">
						<Label for="sourceType">Type</Label>
						<select
							class={NATIVE_SELECT_CLASS}
							id="sourceType"
							onChange={(e) => {
								const newType = e.currentTarget.value as MediaSourceTypeEnum;
								setRemoteSourcesError(null);
								if (newType !== "remote") {
									setRemoteServerAddress("");
									setRemoteSourceOptions([]);
								}
								setFormData({
									type: newType,
									connectionInfo:
										newType === formData.type ? formData.connectionInfo : {},
								});
							}}
							value={formData.type}
						>
							{SOURCE_TYPE_OPTIONS.map((option) => (
								<option value={option.value}>{option.label}</option>
							))}
						</select>
					</div>

					<div class="space-y-4 rounded-md border p-4">
						<h4 class="font-medium text-sm">Connection Details</h4>

						<Show when={formData.type === "local"}>
							<div class="space-y-2">
								<Label for="path">Directory Path</Label>
								<Input
									id="path"
									onInput={(e) =>
										setFormData("connectionInfo", "path", e.currentTarget.value)
									}
									placeholder="/mnt/data/photos"
									value={(formData.connectionInfo.path as string) || ""}
								/>
								<Show when={errors().path}>
									<p class="text-red-500 text-sm">{errors().path}</p>
								</Show>
							</div>
						</Show>

						<Show when={formData.type === "sftp"}>
							<div class="grid grid-cols-2 gap-4">
								<div class="space-y-2">
									<Label for="host">Host</Label>
									<Input
										id="host"
										onInput={(e) =>
											setFormData(
												"connectionInfo",
												"host",
												e.currentTarget.value,
											)
										}
										placeholder="192.168.1.10"
										value={(formData.connectionInfo.host as string) || ""}
									/>
									<Show when={errors().host}>
										<p class="text-red-500 text-sm">{errors().host}</p>
									</Show>
								</div>
								<div class="space-y-2">
									<Label for="port">Port</Label>
									<Input
										id="port"
										onInput={(e) =>
											setFormData(
												"connectionInfo",
												"port",
												e.currentTarget.value,
											)
										}
										placeholder="22"
										type="number"
										value={formData.connectionInfo.port || DEFAULT_SFTP_PORT}
									/>
								</div>
							</div>
							<div class="space-y-2">
								<Label for="username">Username</Label>
								<Input
									id="username"
									onInput={(e) =>
										setFormData(
											"connectionInfo",
											"username",
											e.currentTarget.value,
										)
									}
									placeholder="user"
									value={(formData.connectionInfo.username as string) || ""}
								/>
								<Show when={errors().username}>
									<p class="text-red-500 text-sm">{errors().username}</p>
								</Show>
							</div>
							<div class="space-y-2">
								<Label for="password">Password (Optional)</Label>
								<Input
									id="password"
									onInput={(e) =>
										setFormData(
											"connectionInfo",
											"password",
											e.currentTarget.value,
										)
									}
									placeholder="********"
									type="password"
									value={(formData.connectionInfo.password as string) || ""}
								/>
							</div>
							<div class="space-y-2">
								<Label for="remotePath">Remote Path</Label>
								<Input
									id="remotePath"
									onInput={(e) =>
										setFormData(
											"connectionInfo",
											"remotePath",
											e.currentTarget.value,
										)
									}
									placeholder="/home/user/photos"
									value={(formData.connectionInfo.remotePath as string) || ""}
								/>
								<Show when={errors().remotePath}>
									<p class="text-red-500 text-sm">{errors().remotePath}</p>
								</Show>
							</div>
						</Show>

						<Show when={formData.type === "s3"}>
							<div class="grid grid-cols-2 gap-4">
								<div class="space-y-2">
									<Label for="bucket">Bucket</Label>
									<Input
										id="bucket"
										onInput={(e) =>
											setFormData(
												"connectionInfo",
												"bucket",
												e.currentTarget.value,
											)
										}
										placeholder="my-bucket"
										value={(formData.connectionInfo.bucket as string) || ""}
									/>
									<Show when={errors().bucket}>
										<p class="text-red-500 text-sm">{errors().bucket}</p>
									</Show>
								</div>
								<div class="space-y-2">
									<Label for="region">Region</Label>
									<Input
										id="region"
										onInput={(e) =>
											setFormData(
												"connectionInfo",
												"region",
												e.currentTarget.value,
											)
										}
										placeholder="us-east-1"
										value={(formData.connectionInfo.region as string) || ""}
									/>
									<Show when={errors().region}>
										<p class="text-red-500 text-sm">{errors().region}</p>
									</Show>
								</div>
							</div>
							<div class="space-y-2">
								<Label for="accessKeyId">Access Key ID</Label>
								<Input
									id="accessKeyId"
									onInput={(e) =>
										setFormData(
											"connectionInfo",
											"accessKeyId",
											e.currentTarget.value,
										)
									}
									placeholder="AKIA..."
									value={(formData.connectionInfo.accessKeyId as string) || ""}
								/>
								<Show when={errors().accessKeyId}>
									<p class="text-red-500 text-sm">{errors().accessKeyId}</p>
								</Show>
							</div>
							<div class="space-y-2">
								<Label for="secretAccessKey">Secret Access Key</Label>
								<Input
									id="secretAccessKey"
									onInput={(e) =>
										setFormData(
											"connectionInfo",
											"secretAccessKey",
											e.currentTarget.value,
										)
									}
									placeholder="********"
									type="password"
									value={
										(formData.connectionInfo.secretAccessKey as string) || ""
									}
								/>
								<Show when={errors().secretAccessKey}>
									<p class="text-red-500 text-sm">{errors().secretAccessKey}</p>
								</Show>
							</div>
							<div class="space-y-2">
								<Label for="prefix">Prefix (Optional)</Label>
								<Input
									id="prefix"
									onInput={(e) =>
										setFormData(
											"connectionInfo",
											"prefix",
											e.currentTarget.value,
										)
									}
									placeholder="photos/"
									value={(formData.connectionInfo.prefix as string) || ""}
								/>
							</div>
						</Show>

						<Show when={formData.type === "remote"}>
							<div class="space-y-2">
								<Label for="remoteServerAddress">
									Remote Server URL / Host
								</Label>
								<div class="flex gap-2">
									<Input
										id="remoteServerAddress"
										onInput={(e) => {
											const address = e.currentTarget.value;
											setRemoteServerAddress(address);
											setRemoteSourcesError(null);
											try {
												setFormData(
													"connectionInfo",
													"url",
													normalizeRemoteServerUrl(address),
												);
											} catch {
												setFormData("connectionInfo", "url", address);
											}
											setFormData("connectionInfo", "remoteSourceId", "");
											setRemoteSourceOptions([]);
										}}
										placeholder="192.168.1.100:3000/app"
										value={remoteServerAddress()}
									/>
									<Button
										disabled={isLoadingRemoteSources()}
										onClick={() => void loadRemoteSources()}
										type="button"
										variant="outline"
									>
										{isLoadingRemoteSources() ? "Loading..." : "Load Sources"}
									</Button>
								</div>
								<Show when={errors().url}>
									<p class="text-red-500 text-sm">{errors().url}</p>
								</Show>
								<Show when={remoteSourcesError()}>
									<p class="text-red-500 text-sm">{remoteSourcesError()}</p>
								</Show>
							</div>
							<div class="space-y-2">
								<Label for="remoteSourceId">Remote Source</Label>
								<select
									class={NATIVE_SELECT_CLASS}
									id="remoteSourceId"
									onChange={(e) =>
										setFormData(
											"connectionInfo",
											"remoteSourceId",
											e.currentTarget.value,
										)
									}
									value={
										(formData.connectionInfo.remoteSourceId as string) || ""
									}
								>
									<option value="">Select a remote source</option>
									{remoteSourceOptions().map((option) => (
										<option value={option.value}>{option.label}</option>
									))}
								</select>
								<p class="text-muted-foreground text-sm">
									Only local sources on the remote server can be selected.
								</p>
								<Show when={errors().remoteSourceId}>
									<p class="text-red-500 text-sm">{errors().remoteSourceId}</p>
								</Show>
							</div>
						</Show>
					</div>

					<DialogFooter>
						<Button
							onClick={() => props.onClose()}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button type="submit">
							{props.editingSource ? "Save Changes" : "Add Source"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
