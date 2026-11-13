import { t } from "@solid-imager/i18n";
import type { Author, NewAuthor } from "@solid-imager/core/authors";
import { createQuery } from "@tanstack/solid-query";
import { createMemo, createSignal, For, Show } from "solid-js";
import { Button } from "../../button";
import { Checkbox, CheckboxControl, CheckboxLabel } from "../../checkbox";
import {
	Combobox,
	ComboboxContent,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemLabel,
	ComboboxLabel,
	ComboboxTrigger,
} from "../../combobox";
import { Label } from "../../label";
import { TextField, TextFieldInput, TextFieldLabel } from "../../text-field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../../dialog";
import { ErrorState } from "../../async-state";
import { createDebouncedSignal } from "../../utils/debounce";
import { AuthorAccountVerificationPanel } from "./author-account-verification";
import { ManagedThumbnailImage } from "../../managed-thumbnail-image";
import type { AuthorManagementActions } from "./authors.types";

function authorLabel(author: Author): string {
	const accounts = author.accounts
		?.map(
			(account) =>
				`${account.platform ?? t("status.unknown")}: ${account.accountId}`,
		)
		.join(" / ");
	return t("authors.valueValueValue", {
		value0: author.name,
		value1:
			accounts || author.accountId ? ` (${accounts || author.accountId})` : "",
		value2: author.id.slice(0, 8),
	});
}

function AuthorPicker(props: {
	label: string;
	options: Author[];
	value: Author | null;
	disabled?: boolean;
	onChange: (author: Author | null) => void;
}) {
	const [filterText, setFilterText] = createDebouncedSignal("", 150);
	const searchableAuthors = createMemo(() =>
		props.options.map((author) => {
			const label = authorLabel(author);
			return { author, label, searchText: label.toLowerCase() };
		}),
	);
	const labels = createMemo(
		() =>
			new Map(
				searchableAuthors().map(({ author, label }) => [author.id, label]),
			),
	);
	const getLabel = (author: Author) =>
		labels().get(author.id) ?? authorLabel(author);
	const filteredAuthors = createMemo(() => {
		const query = filterText().toLowerCase();
		const matches: Author[] = [];
		for (const { author, searchText } of searchableAuthors()) {
			if (!searchText.includes(query)) continue;
			matches.push(author);
			if (matches.length === 100) break;
		}
		return matches;
	});
	const filteredIds = createMemo(
		() => new Set(filteredAuthors().map((author) => author.id)),
	);
	const options = createMemo(() => {
		const selected = props.value;
		// Kobalte resolves the controlled selection from options, even when filtered out.
		return selected && !filteredIds().has(selected.id)
			? [...filteredAuthors(), selected]
			: filteredAuthors();
	});

	return (
		<Combobox<Author>
			options={options()}
			value={props.value}
			onChange={props.onChange}
			onInputChange={setFilterText}
			// Filter only after the debounce; do not repeat live filtering on each keystroke.
			defaultFilter={(author) => filteredIds().has(author.id)}
			disabled={props.disabled}
			optionValue="id"
			optionTextValue={getLabel}
			optionLabel={getLabel}
			itemComponent={(item) => (
				<ComboboxItem item={item.item}>
					<ComboboxItemLabel>{item.item.textValue}</ComboboxItemLabel>
				</ComboboxItem>
			)}
		>
			<ComboboxLabel>{props.label}</ComboboxLabel>
			<ComboboxControl class="mt-1 w-full">
				<ComboboxInput
					placeholder={t("authors.searchByAuthorNameOrUsername")}
				/>
				<ComboboxTrigger
					aria-label={t("authors.candidatesForValue", {
						value0: String(props.label),
					})}
				/>
			</ComboboxControl>
			<ComboboxContent />
		</Combobox>
	);
}

export function AuthorManagementPanel(props: {
	actions: AuthorManagementActions;
	sources: { id: string; name: string }[];
}) {
	const [sourceId, setSourceId] = createSignal<string | null>(null);
	const [targetId, setTargetId] = createSignal<string | null>(null);
	const [mediaSourceId, setMediaSourceId] = createSignal<string | undefined>();
	const [offset, setOffset] = createSignal(0);
	const [selected, setSelected] = createSignal(new Set<string>());
	const [busy, setBusy] = createSignal(false);
	const [error, setError] = createSignal("");
	const [status, setStatus] = createSignal("");
	const [confirmation, setConfirmation] = createSignal<
		"correct" | "remove" | "merge" | null
	>(null);
	const [name, setName] = createSignal("");
	const [handle, setHandle] = createSignal("");
	const [remoteId, setRemoteId] = createSignal("");
	const [platform, setPlatform] =
		createSignal<NonNullable<NewAuthor["platform"]>>("twitter");
	const authors = createQuery(() => ({
		queryKey: ["authors", "management"],
		queryFn: props.actions.list,
	}));
	const source = createMemo(
		() => authors.data?.find((author) => author.id === sourceId()) ?? null,
	);
	const target = createMemo(
		() => authors.data?.find((author) => author.id === targetId()) ?? null,
	);
	const media = createQuery(() => ({
		queryKey: ["authors", "media", sourceId(), mediaSourceId(), offset()],
		enabled: Boolean(sourceId()),
		queryFn: () =>
			props.actions.listMedia({
				authorId: sourceId() ?? "",
				mediaSourceId: mediaSourceId(),
				offset: offset(),
				limit: 50,
			}),
	}));
	const resetSelection = () => {
		setSelected(new Set<string>());
		setOffset(0);
		setStatus("");
		setError("");
	};
	const run = async (action: () => Promise<void>) => {
		if (busy()) return;
		setBusy(true);
		setError("");
		setStatus("");
		try {
			await action();
		} catch (failure) {
			setError(
				failure instanceof Error
					? failure.message
					: t("authors.theOperationFailed"),
			);
		} finally {
			setBusy(false);
		}
	};
	const createAuthor = () =>
		run(async () => {
			const author = await props.actions.create({
				name: name(),
				accountId: handle().trim() || undefined,
				platform: handle().trim() ? platform() : undefined,
				remoteId: remoteId().trim() || undefined,
				observedAt: handle().trim() ? new Date() : undefined,
			});
			await authors.refetch();
			setTargetId(author.id);
			setName("");
			setHandle("");
			setRemoteId("");
			setStatus(t("authors.destinationAuthorRegistered"));
		});
	const apply = () =>
		run(async () => {
			const current = source();
			const replacement = target();
			const operation = confirmation();
			if (!current || !operation) return;
			if (operation === "merge") {
				if (!replacement) return;
				const result = await props.actions.merge({
					sourceAuthorId: current.id,
					targetAuthorId: replacement.id,
				});
				setSourceId(replacement.id);
				setTargetId(null);
				setSelected(new Set<string>());
				setOffset(0);
				setStatus(
					t("authors.authorsMergedValueMediaItems", {
						value0: String(result.changedCount),
					}),
				);
			} else {
				const result = await props.actions.correctMedia({
					mediaIds: [...selected()],
					sourceAuthorId: current.id,
					targetAuthorId:
						operation === "remove" ? null : (replacement?.id ?? null),
				});
				setSelected(new Set<string>());
				// Stay on a valid page after removing the final rows on the current page.
				const remaining = Math.max(
					0,
					(media.data?.total ?? 0) - result.changedCount,
				);
				setOffset(
					Math.min(offset(), Math.max(0, Math.ceil(remaining / 50) - 1) * 50),
				);
				setStatus(
					t("authors.updatedAuthorsForValueItems", {
						value0: String(result.changedCount),
					}),
				);
			}
			setConfirmation(null);
			await authors.refetch();
			await media.refetch();
		});
	const allSources = { id: "__all__", name: t("labels.allSources") };
	const platforms = ["twitter", "pixiv-fanbox", "danbooru", "pixiv"] as const;
	return (
		<div class="space-y-5">
			<div>
				<h2 class="font-semibold text-lg">
					{t("types.authorsAndExternalAccounts")}
				</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					{t(
						"authors.verifyEarlierRegistrationsAgainstTheOriginalPostsDisplayNames",
					)}
				</p>
			</div>
			<Show when={authors.isError}>
				<ErrorState
					title={t("authors.couldNotLoadAuthors")}
					onRetry={() => void authors.refetch()}
				/>
			</Show>
			<Show when={authors.isPending}>
				<output>{t("authors.loadingAuthors")}</output>
			</Show>
			<div class="grid gap-4 lg:grid-cols-2">
				<AuthorPicker
					label={t("authors.authorToCorrect")}
					options={authors.data ?? []}
					value={source()}
					disabled={busy()}
					onChange={(author) => {
						setSourceId(author?.id ?? null);
						if (author?.id === targetId()) setTargetId(null);
						resetSelection();
					}}
				/>
				<AuthorPicker
					label={t("authors.correctAuthorDestination")}
					options={(authors.data ?? []).filter(
						(author) => author.id !== sourceId(),
					)}
					value={target()}
					disabled={busy()}
					onChange={(author) => setTargetId(author?.id ?? null)}
				/>
			</div>
			<Show when={source()}>
				{(current) => (
					<section class="space-y-3 border-y py-4">
						<h3 class="font-medium">
							{t("authors.currentRegistrationValue", {
								value0: String(current().name),
							})}
						</h3>
						<For each={current().accounts ?? []}>
							{(account) => (
								<div class="break-words text-sm">
									<span>
										{account.platform ?? t("authors.unknownPlatform")} /{" "}
										{account.displayName ?? current().name} /{" "}
										{account.accountId}
									</span>
									<p class="text-xs text-muted-foreground">
										{t("authors.stableIDValueValue", {
											value1: String(
												account.remoteId ??
													t(
														"authors.unverifiedUsernamesAloneCannotTrackRenamingOrReuse",
													),
											),
										})}
									</p>
									<Show
										when={
											account.platform === null ||
											account.platform === "twitter"
										}
									>
										<AuthorAccountVerificationPanel
											account={account}
											authorId={current().id}
											actions={props.actions}
											onSaved={async () => {
												await authors.refetch();
												await media.refetch();
												setStatus(
													t("authors.stableIDVerifiedFutureImportsWillUseItTo"),
												);
											}}
										/>
									</Show>
								</div>
							)}
						</For>
						<Show when={!current().accounts?.length}>
							<AuthorAccountVerificationPanel
								account={null}
								authorId={current().id}
								actions={props.actions}
								onSaved={async () => {
									await authors.refetch();
									await media.refetch();
									setStatus(
										t("authors.stableIDVerifiedFutureImportsWillUseItTo"),
									);
								}}
							/>
						</Show>
						<form
							class="flex flex-wrap items-end gap-2"
							onSubmit={(event) => {
								event.preventDefault();
								const form = event.currentTarget;
								const input = form.elements.namedItem("authorName");
								if (!(input instanceof HTMLInputElement)) return;
								void run(async () => {
									await props.actions.updateName({
										id: current().id,
										name: input.value,
									});
									await authors.refetch();
									await media.refetch();
									setStatus(t("authors.authorManagementNameUpdated"));
								});
							}}
						>
							<TextField class="min-w-0 flex-1">
								<TextFieldLabel>
									{t("authors.authorManagementName")}
								</TextFieldLabel>
								<TextFieldInput
									name="authorName"
									required
									value={current().name}
									disabled={busy()}
								/>
							</TextField>
							<Button variant="outline" disabled={busy()} type="submit">
								{t("authors.saveManagementName")}
							</Button>
						</form>
					</section>
				)}
			</Show>
			<details class="border-y py-3">
				<summary class="cursor-pointer font-medium">
					{t("authors.registerANewDestinationAuthor")}
				</summary>
				<form
					class="mt-3 space-y-3"
					onSubmit={(event) => {
						event.preventDefault();
						void createAuthor();
					}}
				>
					<TextField>
						<TextFieldLabel>{t("authors.authorName")}</TextFieldLabel>
						<TextFieldInput
							required
							value={name()}
							onInput={(event) => setName(event.currentTarget.value)}
							disabled={busy()}
						/>
					</TextField>
					<div class="grid gap-3 sm:grid-cols-2">
						<div>
							<Label>{t("authors.platform")}</Label>
							<Select
								options={[...platforms]}
								value={platform()}
								onChange={(value) => {
									if (value) setPlatform(value);
								}}
								itemComponent={(item) => (
									<SelectItem item={item.item}>{item.item.rawValue}</SelectItem>
								)}
								disabled={busy()}
							>
								<SelectTrigger aria-label={t("authors.platform")}>
									<SelectValue<string>>
										{(state) => state.selectedOption()}
									</SelectValue>
								</SelectTrigger>
								<SelectContent />
							</Select>
						</div>
						<TextField>
							<TextFieldLabel>
								{t("authors.usernameOrCreatorIdentifier")}
							</TextFieldLabel>
							<TextFieldInput
								value={handle()}
								onInput={(event) => setHandle(event.currentTarget.value)}
								disabled={busy()}
							/>
						</TextField>
					</div>
					<TextField>
						<TextFieldLabel>
							{t("authors.stableIDOnlyIfVerified")}
						</TextFieldLabel>
						<TextFieldInput
							value={remoteId()}
							onInput={(event) => setRemoteId(event.currentTarget.value)}
							disabled={busy()}
						/>
					</TextField>
					<p class="text-xs text-muted-foreground">
						{t("authors.forTwitterEnterTheNumericUserIDDoNot")}
					</p>
					<Button type="submit" disabled={busy() || !name().trim()}>
						{t("authors.registerAndSetAsDestination")}
					</Button>
				</form>
			</details>
			<Show when={sourceId()}>
				<div class="max-w-sm">
					<Label>{t("labels.targetSource")}</Label>
					<Select
						options={[allSources, ...props.sources]}
						optionValue="id"
						optionTextValue="name"
						value={
							props.sources.find((value) => value.id === mediaSourceId()) ??
							allSources
						}
						disabled={busy()}
						onChange={(value) => {
							setMediaSourceId(
								value?.id === allSources.id ? undefined : value?.id,
							);
							resetSelection();
						}}
						itemComponent={(item) => (
							<SelectItem item={item.item}>
								{item.item.rawValue.name}
							</SelectItem>
						)}
					>
						<SelectTrigger aria-label={t("labels.targetSource")}>
							<SelectValue<{ id: string; name: string }>>
								{(state) => state.selectedOption()?.name}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
				</div>
				<Show when={media.isPending}>
					<output>{t("authors.loadingMedia")}</output>
				</Show>
				<Show when={media.isError}>
					<ErrorState
						title={t("authors.couldNotLoadMedia")}
						onRetry={() => void media.refetch()}
					/>
				</Show>
				<Show when={media.data}>
					{(page) => (
						<>
							<div class="flex flex-wrap items-center gap-2">
								<p class="mr-auto text-sm">
									{t("authors.valueTotalValueSelected", {
										value0: String(page().total),
										value1: String(selected().size),
									})}
								</p>
								<Button
									variant="outline"
									disabled={busy()}
									onClick={() =>
										void run(async () => {
											resetSelection();
											await authors.refetch();
											await media.refetch();
										})
									}
								>
									{t("authors.reloadList")}
								</Button>
								<Button
									variant="outline"
									disabled={busy() || !page().items.length}
									onClick={() =>
										setSelected(new Set(page().items.map((item) => item.id)))
									}
								>
									{t("authors.selectThisPage")}
								</Button>
								<Button
									variant="ghost"
									disabled={busy()}
									onClick={() => setSelected(new Set<string>())}
								>
									{t("actions.clearSelection")}
								</Button>
							</div>
							<Show when={page().items.length === 0}>
								<p class="py-4 text-sm text-muted-foreground">
									{t("authors.noMediaIsAssociatedWithThisAuthor")}
								</p>
							</Show>
							<div class="divide-y border-y">
								<For each={page().items}>
									{(item) => (
										<div class="flex min-w-0 gap-3 py-3">
											<Checkbox
												checked={selected().has(item.id)}
												disabled={busy()}
												onChange={(checked) =>
													setSelected((previous) => {
														const next = new Set(previous);
														if (checked) next.add(item.id);
														else next.delete(item.id);
														return next;
													})
												}
												class="flex min-h-11 items-center"
											>
												<CheckboxControl />
												<CheckboxLabel class="sr-only">
													{t("sourceMediaGrid.selectValue", {
														value0: String(item.fileName),
													})}
												</CheckboxLabel>
											</Checkbox>
											<ManagedThumbnailImage
												alt={item.fileName}
												releaseUrl={props.actions.releaseThumbnailUrl}
												src={props.actions.thumbnailUrl(
													item.mediaSourceId,
													item.id,
												)}
												loading="lazy"
												class="h-16 w-20 shrink-0 rounded-md object-cover"
											/>
											<div class="min-w-0 flex-1 space-y-1">
												<p class="break-words font-medium text-sm">
													{item.fileName}
												</p>
												<p class="break-words text-xs text-muted-foreground">
													{t("authors.currentAuthorValueValue", {
														value1: String(
															item.authors.map(authorLabel).join(" / "),
														),
													})}
												</p>
												<For
													each={item.sourceUrls.filter((url) =>
														/^https?:\/\//.test(url),
													)}
												>
													{(url) => (
														<a
															class="block break-all text-xs text-primary underline"
															href={url}
															target="_blank"
															rel="noopener noreferrer"
														>
															{url}
														</a>
													)}
												</For>
											</div>
										</div>
									)}
								</For>
							</div>
							<div class="flex flex-wrap items-center justify-between gap-2">
								<Button
									variant="outline"
									disabled={busy() || offset() === 0}
									onClick={() => {
										setOffset(Math.max(0, offset() - 50));
										setSelected(new Set<string>());
									}}
								>
									{t("jobsScreen.previousPage")}
								</Button>
								<span class="text-xs">
									{page().total ? offset() + 1 : 0}–
									{offset() + page().items.length} / {page().total}
								</span>
								<Button
									variant="outline"
									disabled={busy() || offset() + 50 >= page().total}
									onClick={() => {
										setOffset(offset() + 50);
										setSelected(new Set<string>());
									}}
								>
									{t("jobsScreen.nextPage")}
								</Button>
							</div>
						</>
					)}
				</Show>
				<div class="flex flex-wrap gap-2 border-t pt-4">
					<Button
						disabled={
							busy() || !selected().size || !target() || media.isFetching
						}
						onClick={() => setConfirmation("correct")}
					>
						{t("authors.reassignSelectedMediaToAnotherAuthor")}
					</Button>
					<Button
						variant="outline"
						disabled={busy() || !selected().size || media.isFetching}
						onClick={() => setConfirmation("remove")}
					>
						{t("authors.removeThisAuthorFromSelectedMedia")}
					</Button>
					<Button
						variant="outline"
						disabled={busy() || !target()}
						onClick={() => setConfirmation("merge")}
					>
						{t("authors.mergeThisAuthorIntoTheDestination")}
					</Button>
				</div>
			</Show>
			<Show when={error()}>
				<p role="alert" class="break-words text-sm text-destructive">
					{error()}
				</p>
			</Show>
			<Show when={status()}>
				<output class="block text-sm">{status()}</output>
			</Show>
			<Dialog
				open={confirmation() !== null}
				onOpenChange={(open) => {
					if (!open && !busy()) setConfirmation(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{confirmation() === "merge"
								? t("authors.confirmAuthorMerge")
								: t("authors.confirmMediaAuthorChanges")}
						</DialogTitle>
						<DialogDescription>
							{confirmation() === "merge"
								? t("authors.moveAllMediaExternalAccountsAndTagsFromValue", {
										value0: String(source()?.name),
										value1: String(target()?.name),
									})
								: t("authors.applyValueForValueToValueSelectedItemsOther", {
										value0: String(selected().size),
										value1: String(source()?.name),
										value2: String(
											confirmation() === "remove"
												? t("authors.remove")
												: t("authors.reassignToValue", {
														value0: String(target()?.name),
													}),
										),
									})}
						</DialogDescription>
					</DialogHeader>
					<Show when={error()}>
						<p role="alert" class="text-sm text-destructive">
							{error()}
						</p>
					</Show>
					<DialogFooter>
						<Button
							variant="outline"
							disabled={busy()}
							onClick={() => setConfirmation(null)}
						>
							{t("actions.cancel")}
						</Button>
						<Button disabled={busy()} onClick={() => void apply()}>
							{busy() ? t("status.saving") : t("authors.confirmAndRun")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
