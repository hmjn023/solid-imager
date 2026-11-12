import { t } from "@solid-imager/i18n";
import type {
	AuthorAccount,
	AuthorAccountVerification,
} from "@solid-imager/core/authors";
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
import type { AuthorManagementActions } from "./authors.types";

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
				: t("authorAccountVerification.couldNotVerifyTheFetchedData")
			: "") ||
		(timedOut() && !result.data?.profile
			? t(
					"authorAccountVerification.couldNotFetchTheProfileCheckXtracterUpdatesIts",
				)
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
					: t("authorAccountVerification.couldNotStartVerification"),
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
					: t("authorAccountVerification.couldNotSaveVerification"),
			);
		} finally {
			setBusy(false);
		}
	};
	return (
		<div class="mt-3 space-y-2">
			<Show when={props.account?.remoteId}>
				<p class="text-sm">
					{t(
						"authorAccountVerification.stableIDVerifiedUpdatedAutomaticallyOnFutureImports",
					)}
				</p>
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
					<TextFieldLabel>
						{t("authorAccountVerification.currentXUsername")}
					</TextFieldLabel>
					<TextFieldInput
						placeholder={t("authorAccountVerification.username")}
						required
						pattern="@?[A-Za-z0-9_]{1,15}"
					/>
				</TextField>
				<Button
					type="submit"
					variant="outline"
					disabled={busy() || !username().trim()}
				>
					{busy()
						? t("authorAccountVerification.fetching")
						: t("authorAccountVerification.fetchAndVerifyProfile")}
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
						<DialogTitle>
							{t("authorAccountVerification.verifyXAccount")}
						</DialogTitle>
						<DialogDescription>
							{t(
								"authorAccountVerification.openAndFetchTheCurrentProfileThenVerifyIt",
							)}
						</DialogDescription>
					</DialogHeader>
					<p class="break-words text-sm">
						{t(
							"authorAccountVerification.registeredValueValueStableIDValueValue",
							{
								value0: String(
									props.account?.displayName ??
										t("authorAccountVerification.noDisplayNameRegistered"),
								),
								value1: String(
									props.account?.accountId.replace(/^@/, "") ??
										t("authorAccountVerification.notRegistered"),
								),
								value3: String(
									props.account?.remoteId ??
										t("authorAccountVerification.unverified"),
								),
							},
						)}
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
								{t("authorAccountVerification.openAndFetchXProfile")}
							</a>
						)}
					</Show>
					<p class="text-xs text-muted-foreground">
						{t("authorAccountVerification.anUpToDateXtracterIsRequiredSetIts")}
					</p>
					<Show when={!result.data?.profile && !failureMessage()}>
						<output class="text-sm" aria-live="polite">
							{t("authorAccountVerification.waitingForXProfileData")}
						</output>
					</Show>
					<Show when={result.data?.profile}>
						{(profile) => (
							<div class="space-y-2">
								<dl class="grid grid-cols-2 gap-x-3 gap-y-1 break-words text-sm">
									<dt>{t("authorAccountVerification.fetchedDisplayName")}</dt>
									<dd>{profile().displayName}</dd>
									<dt>{t("authorAccountVerification.currentUsername")}</dt>
									<dd>@{profile().username}</dd>
									<dt>{t("authorAccountVerification.stableID")}</dt>
									<dd>{profile().remoteId}</dd>
								</dl>
								<Checkbox
									checked={confirmed()}
									onChange={setConfirmed}
									disabled={busy()}
								>
									<CheckboxControl />
									<CheckboxLabel>
										{t(
											"authorAccountVerification.iVerifiedThatThisIsTheOriginalAuthorS",
										)}
									</CheckboxLabel>
								</Checkbox>
								<p class="text-xs text-muted-foreground">
									{t(
										"authorAccountVerification.afterVerificationUseTheStableIDToMatchThe",
									)}
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
							{t("authorAccountVerification.fetchAgain")}
						</Button>
					</Show>
					<DialogFooter>
						<Button
							variant="outline"
							disabled={busy()}
							onClick={() => setOpen(false)}
						>
							{t("actions.cancel")}
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
							{t("authorAccountVerification.verifySameAccountAndUpdate")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
