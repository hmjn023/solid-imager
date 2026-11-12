import { t } from "@solid-imager/i18n";
import type { Character } from "@solid-imager/core/characters";
import type { Ip } from "@solid-imager/core/ips";
import type { MediaDetails } from "@solid-imager/core/media";
import type { Project } from "@solid-imager/core/projects";
import { getErrorMessage } from "@solid-imager/core/utils";
// oxlint-disable-next-line typescript/no-deprecated -- TanStack Router's current Solid custom navigation-blocking API is exported under this deprecated annotation.
import { useBlocker } from "@tanstack/solid-router";
import {
	type Accessor,
	createEffect,
	createMemo,
	createSignal,
	For,
	Show,
} from "solid-js";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./alert-dialog";
import {
	formatBytes,
	MediaDetailInspector,
	MediaFileInformation,
} from "./media-detail-layout";
import { RelationsEditor } from "./relations-editor";
import { Badge } from "./badge";
import {
	MediaActivityControls,
	type MediaActivityApi,
} from "./media-activity-controls";
import { Button } from "./button";
import { ClipboardCopy } from "./clipboard-copy";
import { Label } from "./label";
import { CollapsibleRoot as Collapsible } from "./collapsible";
import { toast } from "./toast";
import { ChevronDown } from "./workspace/icons";

export type MediaSidebarProps = {
	media: MediaDetails;
	activityApi: MediaActivityApi;
	isUpdating?: Accessor<boolean>;
	projects: Project[];
	allProjects: Project[];
	allIps: Ip[];
	allCharacters: Character[];
	isProjectsLoading?: boolean;
	isAllIpsLoading?: boolean;
	isAllCharactersLoading?: boolean;
	onUpdate?: () => void;
	onPositiveTagsUpdate: (names: string[]) => Promise<void>;
	onDescriptionUpdate: (description: string) => void | Promise<void>;
	onProjectAdd: (projectId: string) => void | Promise<void>;
	onProjectRemove: (projectId: string) => void | Promise<void>;
	onProjectCreate: (name: string) => Promise<{ id: string }>;
	onIpAdd: (ipId: string) => void | Promise<void>;
	onIpRemove: (ipId: string) => void | Promise<void>;
	onIpCreate: (name: string) => Promise<{ id: string }>;
	onCharacterAdd: (characterId: string) => void | Promise<void>;
	onCharacterRemove: (characterId: string) => void | Promise<void>;
	onCharacterCreate: (name: string) => Promise<{ id: string }>;
};

export function MediaSidebar(props: MediaSidebarProps) {
	const tags = createMemo(() => props.media.tags || []);
	const [editingTags, setEditingTags] = createSignal(false);
	const [tagText, setTagText] = createSignal("");
	const [savingTags, setSavingTags] = createSignal(false);
	const [isEditingDescription, setIsEditingDescription] = createSignal(false);
	const [descriptionValue, setDescriptionValue] = createSignal(
		props.media.description || "",
	);
	const descriptionDirty = () =>
		isEditingDescription() &&
		descriptionValue() !== (props.media.description ?? "");
	const navigationBlocker = useBlocker({
		shouldBlockFn: () =>
			descriptionDirty() ||
			(editingTags() &&
				tagText() !==
					tags()
						.filter((tag) => tag.type === "positive")
						.map((tag) => tag.name)
						.join("\n")),
		enableBeforeUnload: () =>
			descriptionDirty() ||
			(editingTags() &&
				tagText() !==
					tags()
						.filter((tag) => tag.type === "positive")
						.map((tag) => tag.name)
						.join("\n")),
		withResolver: true,
	});
	const [allowBlockedNavigation, setAllowBlockedNavigation] =
		createSignal(false);

	createEffect(() => {
		if (!isEditingDescription()) {
			setDescriptionValue(props.media.description || "");
		}
	});

	const positiveTags = createMemo(() =>
		tags().filter((tag) => tag.type === "positive"),
	);

	const negativeTags = createMemo(() =>
		tags().filter((tag) => tag.type === "negative"),
	);

	const genInfo = createMemo(() => props.media.generationInfo);

	const handleSaveDescription = async () => {
		try {
			await props.onDescriptionUpdate(descriptionValue());
			setIsEditingDescription(false);
			props.onUpdate?.();
		} catch (error) {
			toast.error(
				t("mediaSidebar.failedToUpdateDescriptionValue", {
					value0: String(getErrorMessage(error)),
				}),
			);
		}
	};

	const handleCancelEdit = () => {
		setDescriptionValue(props.media.description || "");
		setIsEditingDescription(false);
	};

	return (
		<MediaDetailInspector>
			<div class="space-y-2">
				<div class="flex items-start justify-between gap-2">
					<h2 class="font-semibold text-sm">{t("labels.description")}</h2>
					<Show when={!isEditingDescription()}>
						<Button
							size="sm"
							variant="outline"
							onClick={() => setIsEditingDescription(true)}
							type="button"
						>
							{t("actions.edit")}
						</Button>
					</Show>
				</div>
				<Show
					fallback={
						<div class="rounded-md bg-muted p-3 text-muted-foreground text-sm italic">
							{t("labels.noDescription")}
						</div>
					}
					when={isEditingDescription() || props.media.description}
				>
					<Show
						fallback={
							<div class="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
								{props.media.description}
							</div>
						}
						when={isEditingDescription()}
					>
						<textarea
							class="w-full scroll-mb-24 rounded-md border border-input bg-background p-2 text-base sm:text-sm"
							onInput={(e) => setDescriptionValue(e.currentTarget.value)}
							placeholder={t("mediaSidebar.enterDescription")}
							rows={6}
							value={descriptionValue()}
						/>
						<div class="sticky bottom-0 z-10 -mx-3 flex flex-col gap-2 border-t bg-background px-3 py-3 sm:-mx-4 sm:px-4 lg:static lg:mx-0 lg:flex-row lg:border-0 lg:bg-transparent lg:p-0">
							<Button
								class="w-full lg:w-auto"
								onClick={() => {
									void handleSaveDescription();
								}}
								size="sm"
							>
								{t("actions.save")}
							</Button>
							<Button
								class="w-full lg:w-auto"
								onClick={handleCancelEdit}
								size="sm"
								variant="outline"
							>
								{t("actions.cancel")}
							</Button>
						</div>
					</Show>
				</Show>
			</div>

			<MediaActivityControls media={props.media} api={props.activityApi} />

			<Show when={props.media.urls?.length > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-sm">{t("mediaSidebar.sourceURLs")}</h2>
					<ul class="space-y-1">
						<For each={props.media.urls}>
							{(url) => (
								<li>
									<a
										class="block break-all text-primary text-sm hover:underline"
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

			<Show when={props.media.authors?.length > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-sm">{t("labels.authors")}</h2>
					<ul class="space-y-1">
						<For each={props.media.authors}>
							{(author) => (
								<li>
									<div class="flex min-w-0 items-center gap-2">
										<span class="break-words font-medium">{author.name}</span>
										<Show when={!author.accounts?.length && author.accountId}>
											<span class="break-all text-muted-foreground text-xs">
												({author.accountId})
											</span>
										</Show>
									</div>
									<For each={author.accounts ?? []}>
										{(account) => (
											<p class="break-words text-xs text-muted-foreground">
												{account.platform ?? t("status.unknown")}:{" "}
												{account.displayName ?? author.name} (
												{account.accountId})
											</p>
										)}
									</For>
								</li>
							)}
						</For>
					</ul>
				</div>
			</Show>

			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h2 class="font-semibold text-sm">{t("mediaSidebar.relations")}</h2>
					<RelationsEditor
						disabled={
							props.isProjectsLoading ||
							props.isAllIpsLoading ||
							props.isAllCharactersLoading ||
							props.isUpdating?.()
						}
						characterIps={(id) =>
							props.allCharacters
								.find((character) => character.id === id)
								?.ips.map((ip) => ip.id) ?? []
						}
						onUpdate={props.onUpdate}
						groups={[
							{
								title: t("labels.projects"),
								items: props.projects,
								available: props.allProjects,
								add: props.onProjectAdd,
								remove: props.onProjectRemove,
								create: props.onProjectCreate,
							},
							{
								title: t("labels.ips"),
								items: props.media.ips,
								available: props.allIps,
								add: props.onIpAdd,
								remove: props.onIpRemove,
								create: props.onIpCreate,
							},
							{
								title: t("labels.characters"),
								items: props.media.characters,
								available: props.allCharacters,
								add: props.onCharacterAdd,
								remove: props.onCharacterRemove,
								create: props.onCharacterCreate,
							},
						]}
					/>
				</div>
				<For
					each={[
						{ title: t("labels.projects"), items: props.projects },
						{ title: t("labels.ips"), items: props.media.ips },
						{ title: t("labels.characters"), items: props.media.characters },
					]}
				>
					{(group) => (
						<div class="space-y-2">
							<h3 class="font-semibold text-sm">{group.title}</h3>
							<div class="flex flex-wrap gap-2">
								<For each={group.items}>
									{(item) => <Badge variant="secondary">{item.name}</Badge>}
								</For>
								<Show when={group.items.length === 0}>
									<span class="text-muted-foreground text-sm italic">
										{t("mediaSidebar.noValueAssociated", {
											value0: String(group.title.toLowerCase()),
										})}
									</span>
								</Show>
							</div>
						</div>
					)}
				</For>
			</div>

			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<h2 class="font-semibold text-sm">
						{t("mediaSidebar.positiveTags")}
					</h2>
					<Show when={!editingTags()}>
						<Button
							size="sm"
							variant="outline"
							onClick={() => {
								setTagText(
									positiveTags()
										.map((tag) => tag.name)
										.join("\n"),
								);
								setEditingTags(true);
							}}
						>
							{t("actions.edit")}
						</Button>
					</Show>
				</div>
				<Show
					when={editingTags()}
					fallback={
						<Show when={positiveTags().length === 0}>
							<span class="text-muted-foreground text-sm italic">
								{t("mediaSidebar.noPositiveTags")}
							</span>
						</Show>
					}
				>
					<Label for="positive-tags" class="text-sm text-muted-foreground">
						{t("mediaSidebar.oneTagPerLine")}
					</Label>
					<textarea
						id="positive-tags"
						class="w-full rounded-md border border-input bg-background p-2 text-sm"
						rows={8}
						value={tagText()}
						onInput={(event) => setTagText(event.currentTarget.value)}
					/>
					<div class="flex gap-2">
						<Button
							size="sm"
							disabled={savingTags()}
							onClick={() => {
								void (async () => {
									setSavingTags(true);
									try {
										await props.onPositiveTagsUpdate([
											...new Set(
												tagText()
													.split("\n")
													.map((name) => name.trim())
													.filter(Boolean),
											),
										]);
										setEditingTags(false);
										props.onUpdate?.();
									} catch (error) {
										toast.error(
											t("mediaSidebar.failedToUpdateTagsValue", {
												value0: String(getErrorMessage(error)),
											}),
										);
									} finally {
										setSavingTags(false);
									}
								})();
							}}
						>
							{t("actions.save")}
						</Button>
						<Button
							size="sm"
							variant="outline"
							disabled={savingTags()}
							onClick={() => setEditingTags(false)}
						>
							{t("actions.cancel")}
						</Button>
					</div>
				</Show>
				<Show when={!editingTags()}>
					<div class="flex flex-wrap gap-2">
						<For each={positiveTags()}>
							{(tag) => (
								<Badge
									classList={{
										"border-input":
											tag.source === "AI" || tag.source === "comfyui_workflow",
										"bg-info": tag.source === "AI",
										"dark:bg-info/20": tag.source === "AI",
										"bg-accent": tag.source === "comfyui_workflow",
										"text-primary": tag.source === "comfyui_workflow",
									}}
									title={t("mediaSidebar.sourceValue", {
										value0: String(tag.source),
									})}
									variant={tag.source === "AI" ? "outline" : "default"}
								>
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
				</Show>
			</div>

			<Show when={negativeTags().length > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-sm">
						{t("configScreen.negativeTags")}
					</h2>
					<div class="flex flex-wrap gap-2">
						<For each={negativeTags()}>
							{(tag) => (
								<Badge
									title={t("mediaSidebar.sourceValue", {
										value0: String(tag.source),
									})}
									variant="secondary"
								>
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

			<Show
				when={
					genInfo()?.prompt ||
					genInfo()?.negativePrompt ||
					(genInfo()?.workflow && JSON.stringify(genInfo()?.workflow) !== "{}")
				}
			>
				<div class="space-y-2">
					<Collapsible.Root>
						<Collapsible.Trigger class="flex w-full items-center justify-between font-semibold text-sm">
							{t("mediaSidebar.generationInfo")}
							<ChevronDown
								class="data-[expanded]:rotate-180 transition-transform"
								size={14}
							/>
						</Collapsible.Trigger>
						<Collapsible.Content class="space-y-2 text-sm">
							<Show when={genInfo()?.prompt}>
								<div>
									<div class="mb-1 flex items-center justify-between">
										<span class="font-medium text-muted-foreground">
											{t("mediaSidebar.prompt")}
										</span>
										<ClipboardCopy text={genInfo()?.prompt ?? ""} />
									</div>
									<p class="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
										{genInfo()?.prompt}
									</p>
								</div>
							</Show>
							<Show when={genInfo()?.negativePrompt}>
								<div>
									<div class="mb-1 flex items-center justify-between">
										<span class="font-medium text-muted-foreground">
											{t("mediaSidebar.negativePrompt")}
										</span>
										<ClipboardCopy text={genInfo()?.negativePrompt ?? ""} />
									</div>
									<p class="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
										{genInfo()?.negativePrompt}
									</p>
								</div>
							</Show>
							<Show when={genInfo()?.workflow}>
								<div>
									<div class="mb-1 flex items-center justify-between">
										<span class="font-medium text-muted-foreground">
											{t("mediaSidebar.workflow")}
										</span>
										<ClipboardCopy
											text={
												genInfo()?.workflow
													? JSON.stringify(genInfo()?.workflow)
													: ""
											}
										/>
									</div>
									<pre class="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
										{JSON.stringify(genInfo()?.workflow, null, 2)}
									</pre>
								</div>
							</Show>
						</Collapsible.Content>
					</Collapsible.Root>
				</div>
			</Show>

			<MediaFileInformation
				title={t("mediaSidebar.fileInformation")}
				rows={[
					["Original date", new Date(props.media.createdAt).toLocaleString()],
					["Registered", new Date(props.media.indexedAt).toLocaleString()],
					["Resolution", `${props.media.width} × ${props.media.height}`],
					[
						"File Size",
						props.media.fileSize ? formatBytes(props.media.fileSize) : "N/A",
					],
					[
						"Path",
						<span class="break-all text-xs">{props.media.filePath}</span>,
					],
				]}
			/>

			<AlertDialog
				onOpenChange={(open) => {
					const resolver = navigationBlocker();
					if (!open && resolver.status === "blocked") {
						if (allowBlockedNavigation()) {
							setAllowBlockedNavigation(false);
							return;
						}
						resolver.reset?.();
					}
				}}
				open={navigationBlocker().status === "blocked"}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("configScreen.unsavedChanges")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t(
								"mediaSidebar.youHaveUnsavedChangesToThisDescriptionLeaveWithout",
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							onClick={() => {
								navigationBlocker().reset?.();
							}}
						>
							{t("mediaSidebar.stay")}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								const resolver = navigationBlocker();
								if (resolver.status !== "blocked") return;
								setDescriptionValue(props.media.description ?? "");
								setIsEditingDescription(false);
								setEditingTags(false);
								setAllowBlockedNavigation(true);
								resolver.proceed?.();
							}}
						>
							{t("mediaSidebar.leave")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</MediaDetailInspector>
	);
}
