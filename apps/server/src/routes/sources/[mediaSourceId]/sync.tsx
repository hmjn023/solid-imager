import { Title } from "@solidjs/meta";
import { useParams } from "@tanstack/solid-start";
import { createSignal, Show } from "solid-js";
import { useORPCContext } from "~/hooks/use-orpc";

export default function SourceSyncPage() {
	const params = useParams();
	const orpc = useORPCContext();
	const [remoteUrl, setRemoteUrl] = createSignal("");
	const [remoteSourceId, setRemoteSourceId] = createSignal("");
	const [isSyncing, setIsSyncing] = createSignal(false);
	const [result, setResult] = createSignal<any>(null);
	const [error, setError] = createSignal<string | null>(null);

	const handlePull = async () => {
		setIsSyncing(true);
		setError(null);
		setResult(null);
		try {
			const res = await orpc.sync.pull({
				localSourceId: params.mediaSourceId,
				remoteUrl: remoteUrl(),
				remoteSourceId: remoteSourceId(),
			});
			setResult(res);
		} catch (e: any) {
			setError(e.message || "Sync failed");
		} finally {
			setIsSyncing(false);
		}
	};

	const handlePush = async () => {
		setIsSyncing(true);
		setError(null);
		setResult(null);
		try {
			const res = await orpc.sync.push({
				localSourceId: params.mediaSourceId,
				remoteUrl: remoteUrl(),
				remoteSourceId: remoteSourceId(),
			});
			setResult(res);
		} catch (e: any) {
			setError(e.message || "Sync failed");
		} finally {
			setIsSyncing(false);
		}
	};

	return (
		<div class="container mx-auto p-6 max-w-2xl">
			<Title>Server Sync - {params.mediaSourceId}</Title>
			<h1 class="text-2xl font-bold mb-6">Multi-Server Sync</h1>

			<div class="bg-card p-6 rounded-lg border shadow-sm space-y-4">
				<div>
					<label for="remoteUrl" class="block text-sm font-medium mb-1">
						Remote Server URL
					</label>
					<input
						id="remoteUrl"
						type="text"
						class="w-full border rounded px-3 py-2 bg-background"
						placeholder="https://your-remote-server.com"
						value={remoteUrl()}
						onInput={(e) => setRemoteUrl(e.currentTarget.value)}
					/>
				</div>

				<div>
					<label for="remoteSourceId" class="block text-sm font-medium mb-1">
						Remote Source ID (UUID)
					</label>
					<input
						id="remoteSourceId"
						type="text"
						class="w-full border rounded px-3 py-2 bg-background"
						placeholder="00000000-0000-0000-0000-000000000000"
						value={remoteSourceId()}
						onInput={(e) => setRemoteSourceId(e.currentTarget.value)}
					/>
				</div>

				<div class="flex gap-4 pt-4">
					<button
						type="button"
						class="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded font-medium disabled:opacity-50"
						disabled={isSyncing() || !remoteUrl() || !remoteSourceId()}
						onClick={handlePull}
					>
						Pull from Remote
					</button>
					<button
						type="button"
						class="flex-1 bg-secondary text-secondary-foreground px-4 py-2 rounded font-medium disabled:opacity-50 border"
						disabled={isSyncing() || !remoteUrl() || !remoteSourceId()}
						onClick={handlePush}
					>
						Push to Remote
					</button>
				</div>
			</div>

			<Show when={isSyncing()}>
				<div class="mt-8 text-center animate-pulse text-muted-foreground">
					Synchronizing media and metadata...
				</div>
			</Show>

			<Show when={error()}>
				<div class="mt-8 p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded">
					<h2 class="font-bold">Sync Error</h2>
					<p>{error()}</p>
				</div>
			</Show>

			<Show when={result()}>
				<div class="mt-8 p-4 bg-green-500/10 text-green-600 border border-green-500/20 rounded space-y-2">
					<h2 class="font-bold">Sync Completed</h2>
					<p>{result().message || "Operation successful"}</p>
					<Show when={result().pulledCount !== undefined}>
						<p>Files Pulled: {result().pulledCount}</p>
					</Show>
					<Show when={result().pushedCount !== undefined}>
						<p>Files Pushed: {result().pushedCount}</p>
					</Show>
				</div>
			</Show>
		</div>
	);
}
