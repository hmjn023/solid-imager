import { Badge } from "@solid-imager/ui/badge";
import { Button } from "@solid-imager/ui/button";
import { ClipboardCopy } from "@solid-imager/ui/clipboard-copy";
import { CollapsibleRoot as Collapsible } from "@solid-imager/ui/collapsible";
import { Textarea } from "@solid-imager/ui/textarea";
import { toast } from "@solid-imager/ui/toast";
import { createMemo, createSignal, For, Show } from "solid-js";
import type { MockMedia } from "../../mocks/demo-data";

type MediaSidebarProps = {
	media: MockMedia;
};

function formatBytes(bytes: number, decimals = 2) {
	if (bytes === 0) {
		return "0 Bytes";
	}
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

export function MediaSidebar(props: MediaSidebarProps) {
	const [isEditingDescription, setIsEditingDescription] = createSignal(false);
	const [descriptionValue, setDescriptionValue] = createSignal(
		props.media.description,
	);
	const positiveTags = createMemo(() => props.media.positiveTags);
	const negativeTags = createMemo(() => props.media.negativeTags);

	const saveDescription = () => {
		setIsEditingDescription(false);
		toast.success("Description updated in mock sidebar");
	};

	const cancelDescription = () => {
		setDescriptionValue(props.media.description);
		setIsEditingDescription(false);
	};

	return (
		<aside class="h-full space-y-4 overflow-y-auto rounded-lg border bg-gray-50 p-4">
			<div>
				<h1 class="font-bold text-xl">{props.media.fileName}</h1>
				<p class="text-gray-500 text-sm">{props.media.filePath}</p>
			</div>

			<div class="flex gap-2">
				<button
					class="flex w-full items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-purple-700"
					onClick={() => toast.success("Mock AI extraction started")}
					type="button"
				>
					Extract Tags (AI)
				</button>
			</div>

			<div class="space-y-2">
				<h2 class="font-semibold text-lg">Details</h2>
				<dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
					<dt class="font-medium text-gray-600">Resolution</dt>
					<dd class="text-gray-800">
						{props.media.width} x {props.media.height}
					</dd>
					<dt class="font-medium text-gray-600">File Size</dt>
					<dd class="text-gray-800">{formatBytes(props.media.fileSize)}</dd>
					<dt class="font-medium text-gray-600">Status</dt>
					<dd class="text-gray-800">{props.media.status}</dd>
				</dl>
			</div>

			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<h2 class="font-semibold text-lg">Description</h2>
					<Show when={!isEditingDescription()}>
						<button
							class="text-blue-600 text-sm hover:underline"
							onClick={() => setIsEditingDescription(true)}
							type="button"
						>
							Edit
						</button>
					</Show>
				</div>
				<Show
					fallback={
						<div class="rounded-md bg-gray-100 p-3 text-gray-500 text-sm italic">
							No description
						</div>
					}
					when={isEditingDescription() || props.media.description}
				>
					<Show
						fallback={
							<div class="whitespace-pre-wrap rounded-md bg-gray-100 p-3 text-sm">
								{props.media.description}
							</div>
						}
						when={isEditingDescription()}
					>
						<Textarea
							onInput={(event) =>
								setDescriptionValue(event.currentTarget.value)
							}
							rows={6}
							value={descriptionValue()}
						/>
						<div class="flex gap-2">
							<Button onClick={saveDescription} size="sm">
								Save
							</Button>
							<Button onClick={cancelDescription} size="sm" variant="outline">
								Cancel
							</Button>
						</div>
					</Show>
				</Show>
			</div>

			<Show when={props.media.urls.length > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-lg">Source URLs</h2>
					<ul class="space-y-1">
						<For each={props.media.urls}>
							{(url) => (
								<li>
									<a
										class="block break-all text-blue-600 text-sm hover:underline"
										href={url.url}
										rel="noopener noreferrer"
										target="_blank"
									>
										{url.url}
									</a>
								</li>
							)}
						</For>
					</ul>
				</div>
			</Show>

			<Show when={props.media.authors.length > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-lg">Authors</h2>
					<ul class="space-y-1">
						<For each={props.media.authors}>
							{(author) => (
								<li>
									<div class="flex items-center gap-2">
										<span class="font-medium">{author.name}</span>
										<Show when={author.accountId}>
											<span class="text-gray-500 text-xs">
												({author.accountId})
											</span>
										</Show>
									</div>
								</li>
							)}
						</For>
					</ul>
				</div>
			</Show>

			<div class="space-y-4">
				<AssociationSection items={props.media.projects} title="Projects" />
				<AssociationSection items={props.media.ips} title="IPs" />
				<AssociationSection items={props.media.characters} title="Characters" />
			</div>

			<Show when={positiveTags().length > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-lg">Positive Tags</h2>
					<div class="flex flex-wrap gap-2">
						<For each={positiveTags()}>
							{(tag) => (
								<Badge title={`Source: ${tag.source}`} variant="secondary">
									{tag.name}
									<ClipboardCopy
										class="ml-1.5 p-0.5"
										iconSize={12}
										text={tag.name}
									/>
								</Badge>
							)}
						</For>
					</div>
				</div>
			</Show>

			<Show when={negativeTags().length > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-lg">Negative Tags</h2>
					<div class="flex flex-wrap gap-2">
						<For each={negativeTags()}>
							{(tag) => (
								<Badge title={`Source: ${tag.source}`} variant="destructive">
									{tag.name}
									<ClipboardCopy
										class="ml-1.5 p-0.5"
										iconSize={12}
										text={tag.name}
									/>
								</Badge>
							)}
						</For>
					</div>
				</div>
			</Show>

			<Show when={props.media.generationInfo}>
				<div class="space-y-2">
					<Collapsible.Root>
						<Collapsible.Trigger class="flex w-full items-center justify-between font-semibold text-lg">
							Generation Info
							<span class="text-sm">Toggle</span>
						</Collapsible.Trigger>
						<Collapsible.Content class="space-y-2 text-sm">
							<Show when={props.media.generationInfo?.prompt}>
								<div>
									<div class="mb-1 flex items-center justify-between">
										<span class="font-medium text-gray-600">Prompt:</span>
										<ClipboardCopy
											text={props.media.generationInfo?.prompt ?? ""}
										/>
									</div>
									<p class="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-gray-100 p-2 text-xs">
										{props.media.generationInfo?.prompt}
									</p>
								</div>
							</Show>
							<Show when={props.media.generationInfo?.negativePrompt}>
								<div>
									<div class="mb-1 flex items-center justify-between">
										<span class="font-medium text-gray-600">
											Negative Prompt:
										</span>
										<ClipboardCopy
											text={props.media.generationInfo?.negativePrompt ?? ""}
										/>
									</div>
									<p class="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-gray-100 p-2 text-xs">
										{props.media.generationInfo?.negativePrompt}
									</p>
								</div>
							</Show>
							<Show when={props.media.generationInfo?.workflow}>
								<div>
									<div class="mb-1 flex items-center justify-between">
										<span class="font-medium text-gray-600">Workflow:</span>
										<ClipboardCopy
											text={JSON.stringify(
												props.media.generationInfo?.workflow ?? {},
											)}
										/>
									</div>
									<pre class="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-gray-100 p-2 text-xs">
										{JSON.stringify(
											props.media.generationInfo?.workflow,
											null,
											2,
										)}
									</pre>
								</div>
							</Show>
						</Collapsible.Content>
					</Collapsible.Root>
				</div>
			</Show>
		</aside>
	);
}

function AssociationSection(props: {
	items: MockMedia["projects"];
	title: string;
}) {
	return (
		<div class="space-y-2">
			<h2 class="font-semibold text-lg">{props.title}</h2>
			<div class="flex flex-wrap gap-2">
				<For each={props.items}>
					{(item) => <Badge variant="outline">{item.name}</Badge>}
				</For>
				<Show when={props.items.length === 0}>
					<span class="text-gray-500 text-sm">No items assigned</span>
				</Show>
			</div>
		</div>
	);
}
