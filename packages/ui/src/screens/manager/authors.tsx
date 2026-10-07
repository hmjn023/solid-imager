import type {
	Author,
	AuthorMediaPage,
	NewAuthor,
	AuthorMediaListInput,
	CorrectMediaAuthorsInput,
	MergeAuthorsInput,
	BeginAuthorAccountVerificationInput,
	AuthorAccountVerification,
} from "@solid-imager/core/domain/authors/schemas";
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
import { AuthorAccountVerificationPanel } from "./author-account-verification";

export type AuthorManagementActions = {
	openAccountVerificationProfile?: (url: string) => Promise<void>;
	beginAccountVerification: (
		input: BeginAuthorAccountVerificationInput,
	) => Promise<AuthorAccountVerification>;
	getAccountVerification: (input: {
		verificationId: string;
	}) => Promise<AuthorAccountVerification>;
	confirmAccountVerification: (input: {
		verificationId: string;
	}) => Promise<Author>;
	list: () => Promise<Author[]>;
	create: (input: NewAuthor) => Promise<Author>;
	updateName: (input: { id: string; name: string }) => Promise<Author>;
	listMedia: (input: AuthorMediaListInput) => Promise<AuthorMediaPage>;
	correctMedia: (
		input: CorrectMediaAuthorsInput,
	) => Promise<{ changedCount: number }>;
	merge: (input: MergeAuthorsInput) => Promise<{ changedCount: number }>;
	thumbnailUrl: (sourceId: string, mediaId: string) => string;
};

function authorLabel(author: Author): string {
	const accounts = author.accounts
		?.map((account) => `${account.platform ?? "不明"}: ${account.accountId}`)
		.join(" / ");
	return `${author.name}${accounts || author.accountId ? ` (${accounts || author.accountId})` : ""} · ${author.id.slice(0, 8)}`;
}

function AuthorPicker(props: {
	label: string;
	options: Author[];
	value: Author | null;
	disabled?: boolean;
	onChange: (author: Author | null) => void;
}) {
	return (
		<Combobox<Author>
			options={props.options}
			value={props.value}
			onChange={props.onChange}
			disabled={props.disabled}
			optionValue="id"
			optionTextValue={authorLabel}
			optionLabel={authorLabel}
			itemComponent={(item) => (
				<ComboboxItem
					item={item.item}
				>
					<ComboboxItemLabel>
						{authorLabel(item.item.rawValue)}
					</ComboboxItemLabel>
				</ComboboxItem>
			)}
		>
			<ComboboxLabel>{props.label}</ComboboxLabel>
			<ComboboxControl class="mt-1 w-full">
				<ComboboxInput placeholder="作者名・ユーザー名で検索" />
				<ComboboxTrigger aria-label={`${props.label}の候補`} />
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
				failure instanceof Error ? failure.message : "処理に失敗しました。",
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
			setStatus("修正先の作者を登録しました。");
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
				setStatus(`作者を統合しました（${result.changedCount}件のメディア）。`);
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
				setStatus(`${result.changedCount}件の作者を修正しました。`);
			}
			setConfirmation(null);
			await authors.refetch();
			await media.refetch();
		});
	const allSources = { id: "__all__", name: "すべてのソース" };
	const platforms = ["twitter", "pixiv-fanbox", "danbooru"] as const;
	return (
		<div class="space-y-5">
			<div>
				<h2 class="font-semibold text-lg">作者・外部アカウント</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					過去の誤登録は元投稿と照合して修正してください。表示名・ユーザー名だけでは同一人物と判断できません。
				</p>
			</div>
			<Show when={authors.isError}>
				<ErrorState
					title="作者一覧を取得できませんでした"
					onRetry={() => void authors.refetch()}
				/>
			</Show>
			<Show when={authors.isPending}>
				<output>作者一覧を取得中...</output>
			</Show>
			<div class="grid gap-4 lg:grid-cols-2">
				<AuthorPicker
					label="修正対象の作者"
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
					label="正しい作者（修正先）"
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
						<h3 class="font-medium">現在の登録情報: {current().name}</h3>
						<For each={current().accounts ?? []}>
							{(account) => (
								<div class="break-words text-sm">
									<span>
										{account.platform ?? "プラットフォーム不明"} /{" "}
										{account.displayName ?? current().name} /{" "}
										{account.accountId}
									</span>
									<p class="text-xs text-muted-foreground">
										固定ID:{" "}
										{account.remoteId ??
											"未確認（ユーザー名だけでは改名・再利用を追跡できません）"}
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
													"固定IDを確認済みとして登録しました。以降の取り込み時に固定IDで自動更新します。",
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
										"固定IDを確認済みとして登録しました。以降の取り込み時に固定IDで自動更新します。",
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
									setStatus("作者の管理名を更新しました。");
								});
							}}
						>
							<TextField class="min-w-0 flex-1">
								<TextFieldLabel>作者の管理名</TextFieldLabel>
								<TextFieldInput
									name="authorName"
									required
									value={current().name}
									disabled={busy()}
								/>
							</TextField>
							<Button variant="outline" disabled={busy()} type="submit">
								管理名を保存
							</Button>
						</form>
					</section>
				)}
			</Show>
			<details class="border-y py-3">
				<summary class="cursor-pointer font-medium">
					修正先の作者を新規登録
				</summary>
				<form
					class="mt-3 space-y-3"
					onSubmit={(event) => {
						event.preventDefault();
						void createAuthor();
					}}
				>
					<TextField>
						<TextFieldLabel>作者名</TextFieldLabel>
						<TextFieldInput
							required
							value={name()}
							onInput={(event) => setName(event.currentTarget.value)}
							disabled={busy()}
						/>
					</TextField>
					<div class="grid gap-3 sm:grid-cols-2">
						<div>
							<Label>プラットフォーム</Label>
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
								<SelectTrigger aria-label="プラットフォーム">
									<SelectValue<string>>
										{(state) => state.selectedOption()}
									</SelectValue>
								</SelectTrigger>
								<SelectContent />
							</Select>
						</div>
						<TextField>
							<TextFieldLabel>ユーザー名・クリエイター識別子</TextFieldLabel>
							<TextFieldInput
								value={handle()}
								onInput={(event) => setHandle(event.currentTarget.value)}
								disabled={busy()}
							/>
						</TextField>
					</div>
					<TextField>
						<TextFieldLabel>固定ID（確認できた場合のみ）</TextFieldLabel>
						<TextFieldInput
							value={remoteId()}
							onInput={(event) => setRemoteId(event.currentTarget.value)}
							disabled={busy()}
						/>
					</TextField>
					<p class="text-xs text-muted-foreground">
						Twitterは数値のユーザーIDを指定します。@ユーザー名や投稿IDを固定IDとして入力しないでください。
					</p>
					<Button type="submit" disabled={busy() || !name().trim()}>
						登録して修正先に設定
					</Button>
				</form>
			</details>
			<Show when={sourceId()}>
				<div class="max-w-sm">
					<Label>対象ソース</Label>
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
						<SelectTrigger aria-label="対象ソース">
							<SelectValue<{ id: string; name: string }>>
								{(state) => state.selectedOption()?.name}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
				</div>
				<Show when={media.isPending}>
					<output>メディアを取得中...</output>
				</Show>
				<Show when={media.isError}>
					<ErrorState
						title="メディアを取得できませんでした"
						onRetry={() => void media.refetch()}
					/>
				</Show>
				<Show when={media.data}>
					{(page) => (
						<>
							<div class="flex flex-wrap items-center gap-2">
								<p class="mr-auto text-sm">
									全{page().total}件 / 選択{selected().size}件
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
									一覧を再取得
								</Button>
								<Button
									variant="outline"
									disabled={busy() || !page().items.length}
									onClick={() =>
										setSelected(new Set(page().items.map((item) => item.id)))
									}
								>
									このページを選択
								</Button>
								<Button
									variant="ghost"
									disabled={busy()}
									onClick={() => setSelected(new Set<string>())}
								>
									選択解除
								</Button>
							</div>
							<Show when={page().items.length === 0}>
								<p class="py-4 text-sm text-muted-foreground">
									この作者に紐づくメディアはありません。
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
													{item.fileName}を選択
												</CheckboxLabel>
											</Checkbox>
											<img
												alt={item.fileName}
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
													現在の作者:{" "}
													{item.authors.map(authorLabel).join(" / ")}
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
									前のページ
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
									次のページ
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
						選択したメディアの作者を付け替え
					</Button>
					<Button
						variant="outline"
						disabled={busy() || !selected().size || media.isFetching}
						onClick={() => setConfirmation("remove")}
					>
						選択したメディアからこの作者を外す
					</Button>
					<Button
						variant="outline"
						disabled={busy() || !target()}
						onClick={() => setConfirmation("merge")}
					>
						この作者を修正先に統合
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
								? "作者の統合を確認"
								: "メディアの作者修正を確認"}
						</DialogTitle>
						<DialogDescription>
							{confirmation() === "merge"
								? `「${source()?.name}」の全メディア・外部アカウント・タグを「${target()?.name}」へ移し、元の作者レコードを削除します。ソース絞り込みや選択件数に関係なく全件が対象です。`
								: `選択した${selected().size}件から「${source()?.name}」を${confirmation() === "remove" ? "外します" : `「${target()?.name}」へ付け替えます`}。ほかの作者の関連付けは維持します。`}
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
							キャンセル
						</Button>
						<Button disabled={busy()} onClick={() => void apply()}>
							{busy() ? "保存中..." : "確認して実行"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
