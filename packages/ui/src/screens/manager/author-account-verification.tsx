import type {
	AuthorAccount,
	AuthorAccountVerification,
} from "@solid-imager/core/domain/authors/schemas";
import { createQuery } from "@tanstack/solid-query";
import { createSignal, onCleanup, Show } from "solid-js";
import { Button } from "../../button";
import { Checkbox, CheckboxControl, CheckboxLabel } from "../../checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../../dialog";
import { TextField, TextFieldInput, TextFieldLabel } from "../../text-field";
import type { AuthorManagementActions } from "./authors";

export function AuthorAccountVerificationPanel(props: {
	account: AuthorAccount | null;
	authorId: string;
	actions: AuthorManagementActions;
	onSaved: () => Promise<void>;
}) {
	const [username, setUsername] = createSignal(
		props.account?.accountId.replace(/^@/, "") ?? "",
	);
	const [preview, setPreview] = createSignal<AuthorAccountVerification | null>(
		null,
	);
	const [open, setOpen] = createSignal(false);
	const [confirmed, setConfirmed] = createSignal(false);
	const [busy, setBusy] = createSignal(false);
	const [error, setError] = createSignal("");
	const [timedOut, setTimedOut] = createSignal(false);
	let timeout: ReturnType<typeof setTimeout> | undefined;
	onCleanup(() => clearTimeout(timeout));
	const result = createQuery(() => ({
		queryKey: ["authors", "account-verification", preview()?.verificationId],
		enabled: Boolean(preview()) && open() && !timedOut(),
		queryFn: () =>
			props.actions.getAccountVerification({
				verificationId: preview()?.verificationId ?? "",
			}),
		refetchInterval: (query) =>
			query.state.data?.profile || query.state.data?.error ? false : 1500,
		retry: false,
	}));
	const failureMessage = () =>
		result.data?.error ||
		(result.isError
			? result.error instanceof Error
				? result.error.message
				: "取得結果を確認できませんでした。"
			: "") ||
		(timedOut() && !result.data?.profile
			? "プロフィールを取得できませんでした。xtracterの更新・接続先設定とXへのログインを確認して、再取得してください。"
			: "");
	const begin = async () => {
		if (busy()) return;
		setBusy(true);
		setError("");
		setConfirmed(false);
		setTimedOut(false);
		setPreview(null);
		clearTimeout(timeout);
		try {
			const pending = await props.actions.beginAccountVerification({
				authorId: props.authorId,
				accountId: props.account?.id ?? null,
				username: username(),
			});
			setPreview(pending);
			setOpen(true);
			timeout = setTimeout(() => setTimedOut(true), 90_000);
		} catch (failure) {
			setError(
				failure instanceof Error
					? failure.message
					: "確認を開始できませんでした。",
			);
		} finally {
			setBusy(false);
		}
	};
	const save = async () => {
		const pending = preview();
		if (
			!pending ||
			!confirmed() ||
			!result.data?.profile ||
			failureMessage() ||
			busy()
		)
			return;
		setBusy(true);
		setError("");
		try {
			await props.actions.confirmAccountVerification({
				verificationId: pending.verificationId,
			});
			setOpen(false);
			setPreview(null);
			clearTimeout(timeout);
			await props.onSaved();
		} catch (failure) {
			setError(
				failure instanceof Error
					? failure.message
					: "確認結果を保存できませんでした。",
			);
		} finally {
			setBusy(false);
		}
	};
	return (
		<div class="mt-3 space-y-2">
			<Show when={props.account?.remoteId}>
				<p class="text-sm">固定ID確認済み・以降の取り込み時に自動更新</p>
			</Show>
			<form
				class="flex flex-wrap items-end gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					void begin();
				}}
			>
				<TextField
					value={username()}
					onChange={setUsername}
					disabled={busy()}
					class="min-w-0 flex-1"
				>
					<TextFieldLabel>現在のXユーザー名</TextFieldLabel>
					<TextFieldInput
						placeholder="@username"
						required
						pattern="@?[A-Za-z0-9_]{1,15}"
					/>
				</TextField>
				<Button
					type="submit"
					variant="outline"
					disabled={busy() || !username().trim()}
				>
					{busy() ? "取得中..." : "プロフィールを取得して確認"}
				</Button>
			</form>
			<Show when={error() && !open()}>
				<p role="alert" class="text-sm text-destructive">
					{error()}
				</p>
			</Show>
			<Dialog
				open={open()}
				onOpenChange={(value) => {
					if (!busy()) {
						setOpen(value);
						if (!value) {
							clearTimeout(timeout);
							setPreview(null);
							setConfirmed(false);
						}
					}
				}}
			>
				<DialogContent class="max-w-lg">
					<DialogHeader>
						<DialogTitle>Xアカウントを確認</DialogTitle>
						<DialogDescription>
							現在のプロフィールを開いて取得し、元の作者と同じアカウントか確認してください。
						</DialogDescription>
					</DialogHeader>
					<p class="break-words text-sm">
						登録情報: {props.account?.displayName ?? "表示名未登録"} / @
						{props.account?.accountId.replace(/^@/, "") ?? "未登録"} / 固定ID{" "}
						{props.account?.remoteId ?? "未確認"}
					</p>
					<Show when={preview()}>
						{(pending) => (
							<a
								href={pending().profileUrl}
								target="_blank"
								rel="noopener noreferrer"
								onClick={(event) => {
									const openProfile =
										props.actions.openAccountVerificationProfile;
									if (!openProfile) return;
									event.preventDefault();
									void openProfile(pending().profileUrl).catch(
										(failure: unknown) =>
											setError(
												failure instanceof Error
													? failure.message
													: String(failure),
											),
									);
								}}
								class="text-sm underline underline-offset-4"
							>
								Xプロフィールを開いて取得
							</a>
						)}
					</Show>
					<p class="text-xs text-muted-foreground">
						更新済みのxtracterが必要です。拡張機能の接続先を、このManagerと同じサーバーに設定してください。
					</p>
					<Show when={!result.data?.profile && !failureMessage()}>
						<output class="text-sm" aria-live="polite">
							Xプロフィールからの取得を待っています...
						</output>
					</Show>
					<Show when={result.data?.profile}>
						{(profile) => (
							<div class="space-y-2">
								<dl class="grid grid-cols-2 gap-x-3 gap-y-1 break-words text-sm">
									<dt>取得した表示名</dt>
									<dd>{profile().displayName}</dd>
									<dt>現在のユーザー名</dt>
									<dd>@{profile().username}</dd>
									<dt>固定ID</dt>
									<dd>{profile().remoteId}</dd>
								</dl>
								<Checkbox
									checked={confirmed()}
									onChange={setConfirmed}
									disabled={busy()}
								>
									<CheckboxControl />
									<CheckboxLabel>
										元の作者と同じアカウントであることを確認しました
									</CheckboxLabel>
								</Checkbox>
								<p class="text-xs text-muted-foreground">
									確認後はこの固定IDで照合し、以降の取り込み時に表示名・ユーザー名を自動更新します。
								</p>
							</div>
						)}
					</Show>
					<Show when={error() || failureMessage()}>
						<p role="alert" class="break-words text-sm text-destructive">
							{error() || failureMessage()}
						</p>
						<Button
							variant="outline"
							disabled={busy()}
							onClick={() => void begin()}
						>
							再取得
						</Button>
					</Show>
					<DialogFooter>
						<Button
							variant="outline"
							disabled={busy()}
							onClick={() => setOpen(false)}
						>
							キャンセル
						</Button>
						<Button
							disabled={
								busy() ||
								!confirmed() ||
								!result.data?.profile ||
								Boolean(failureMessage())
							}
							onClick={() => void save()}
						>
							同じアカウントと確認して更新
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
