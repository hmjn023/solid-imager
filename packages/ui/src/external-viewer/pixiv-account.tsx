import { t } from "@solid-imager/i18n";
import type { AppContractClient } from "@solid-imager/core/contract";
import {
	canTransferPixivSession,
	pixivCodeSchema,
	pixivViewerSessionSchema,
	pixivWebSessionSchema,
	type PixivViewerSession,
} from "@solid-imager/core/external-viewer";
import {
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { Button, buttonVariants } from "../button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "../dialog";
import { Input } from "../input";
import { Label } from "../label";

const SESSION_CHECK_INTERVAL_MS = 60_000;

export type ViewerFetch = (
	url: string,
	init?: RequestInit,
) => Promise<Response>;
export type PixivClientFactory = (
	base: string,
	request: ViewerFetch,
) => AppContractClient["viewer"];

export function createPixivAccount(
	base: string,
	createViewer: PixivClientFactory,
	send: ViewerFetch = fetch,
) {
	const storageKey = "solid-imager:pixiv-session:" + base;
	let disposed = false;
	onCleanup(() => {
		disposed = true;
	});
	let checkPending = false;
	let nextCheckAt = 0;
	const [session, setSession] = createSignal<PixivViewerSession>();
	const [ready, setReady] = createSignal(false);
	const [notice, setNotice] = createSignal("");
	const transport = createMemo(() => {
		const token = session()?.token;
		const request: ViewerFetch = async (url, init) => {
			const headers = new Headers(init?.headers);
			if (token) headers.set("Authorization", "Bearer " + token);
			const response = await send(url, {
				...init,
				headers,
				redirect: "error",
				cache: "no-store",
			});
			if (response.status === 401 && token && session()?.token === token) {
				save(undefined);
				setNotice(t("pixivAccount.yourPixivSessionExpiredReconnectToContinue"));
			}
			return response;
		};
		return {
			viewer: createViewer(base, request),
			async animation(id: number) {
				const res = await request(
					new URL("/api/pixiv-animation/" + id, base).href,
				);
				if (!res.ok) throw new Error(t("pixivAccount.couldNotLoadUgoira"));
				return URL.createObjectURL(await res.blob());
			},
		};
	});
	function save(next: PixivViewerSession | undefined) {
		// A newer instance of the viewer can already own this tab's storage key.
		if (disposed) return;
		checkPending = false;
		nextCheckAt = 0;
		setSession(next);
		try {
			if (next) sessionStorage.setItem(storageKey, JSON.stringify(next));
			else sessionStorage.removeItem(storageKey);
		} catch {
			/* Connection still works for the current view without storage. */
		}
	}
	onMount(() => {
		try {
			const parsed = pixivViewerSessionSchema.safeParse(
				JSON.parse(sessionStorage.getItem(storageKey) ?? "null"),
			);
			if (parsed.success && parsed.data.expiresAt > Date.now())
				setSession(parsed.data);
			else save(undefined);
		} catch {
			save(undefined);
		}
		setReady(true);
		const check = () => {
			const current = session();
			if (!current || checkPending || Date.now() < nextCheckAt) return;
			checkPending = true;
			void transport()
				.viewer.checkPixivSession()
				.then(() => {
					if (session() === current) setNotice("");
				})
				.catch(() => {
					if (session() === current)
						setNotice(t("pixivAccount.couldNotVerifyThePixivConnection"));
				})
				.finally(() => {
					if (session() === current) {
						checkPending = false;
						nextCheckAt = Date.now() + SESSION_CHECK_INTERVAL_MS;
					}
				});
		};
		check();
		window.addEventListener("focus", check);
		onCleanup(() => window.removeEventListener("focus", check));
	});
	createEffect(() => {
		const current = session();
		if (!current) return;
		const timeout = setTimeout(
			() => {
				save(undefined);
				setNotice(t("pixivAccount.thePixivConnectionExpired"));
			},
			Math.max(0, current.expiresAt - Date.now()),
		);
		onCleanup(() => clearTimeout(timeout));
	});
	return {
		session,
		ready,
		notice,
		setNotice,
		transport,
		base,
		scope: () => [
			base,
			session()?.userId ?? "guest",
			session()?.expiresAt ?? 0,
		],
		async login(value: string, useCookie: boolean) {
			if (!canTransferPixivSession(new URL(base)))
				throw new Error(t("pixivAccount.useAnHTTPSOrLocalhostServerToConnect"));
			const viewer = transport().viewer;
			let code = value.trim();
			if (useCookie) {
				const credential = pixivWebSessionSchema.safeParse(code);
				if (!credential.success)
					throw new Error(t("pixivAccount.checkYourPHPSESSIDValue"));
				code = (await viewer.issuePixivCode({ sessionId: credential.data }))
					.code;
			}
			const input = pixivCodeSchema.safeParse({ code });
			if (!input.success)
				throw new Error(
					t("pixivAccount.enterTheConnectionCodeShownInXtracter"),
				);
			const next = await viewer.loginPixiv(input.data);
			save(next);
			setNotice("");
		},
		async logout() {
			await transport().viewer.logoutPixiv();
			save(undefined);
			setNotice("");
		},
	};
}

export function PixivAccountDialog(props: {
	account: ReturnType<typeof createPixivAccount>;
	openPixivLogin?: () => Promise<void>;
}) {
	const account = props.account;
	const [open, setOpen] = createSignal(false);
	const [code, setCode] = createSignal("");
	const [busy, setBusy] = createSignal(false);
	const [useCookie, setUseCookie] = createSignal(false);
	const close = (value: boolean) => {
		setOpen(value);
		if (!value) {
			setCode("");
			setUseCookie(false);
		}
	};
	async function submit() {
		if (busy()) return;
		setBusy(true);
		try {
			if (account.session()) await account.logout();
			else {
				const value = code();
				if (useCookie()) setCode("");
				await account.login(value, useCookie());
			}
			close(false);
		} catch (error) {
			account.setNotice(
				error instanceof Error
					? error.message
					: t("pixivAccount.couldNotChangeTheConnection"),
			);
		} finally {
			setBusy(false);
		}
	}
	return (
		<Dialog open={open()} onOpenChange={close}>
			<DialogTrigger as={Button} variant="outline" size="sm">
				{account.session()
					? t("pixivAccount.pixivID") + account.session()?.userId
					: t("pixivAccount.logInToPixiv")}
			</DialogTrigger>
			<DialogContent class="workspace-theme">
				<DialogTitle>{t("pixivAccount.pixivAccount")}</DialogTitle>
				<DialogDescription>
					{account.session()
						? t("pixivAccount.theAccountUsedByThisTabSViewer")
						: t("pixivAccount.connectTheAccountSignedInOnTheOfficialPixiv")}
				</DialogDescription>
				<form
					class="grid gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						void submit();
					}}
				>
					<Show
						when={account.session()}
						fallback={
							<>
								<Show
									keyed
									when={props.openPixivLogin}
									fallback={
										<a
											class={buttonVariants({ variant: "outline" })}
											href="https://accounts.pixiv.net/login"
											target="_blank"
											rel="noopener noreferrer"
										>
											{t("pixivAccount.logInOnPixiv")}
										</a>
									}
								>
									{(openLogin) => (
										<Button
											type="button"
											variant="outline"
											onClick={() => {
												void openLogin().catch(() => {
													account.setNotice(
														t(
															"pixivAccount.couldNotOpenPixivInYourDefaultBrowser",
														),
													);
												});
											}}
										>
											{t("pixivAccount.logInOnPixiv")}
										</Button>
									)}
								</Show>
								<p class="break-all text-sm text-muted-foreground">
									{useCookie()
										? t(
												"pixivAccount.enterThePHPSESSIDFromYourBrowserCookiesToSend",
											) +
											account.base +
											t("pixivAccount.message")
										: t("pixivAccount.setTheXtracterExtensionDestinationTo") +
											account.base +
											t("pixivAccount.andGenerateAConnectionCode")}
								</p>
								<div class="grid gap-2">
									<Label for="pixiv-code">
										{useCookie()
											? t("pixivAccount.pHPSESSID")
											: t("pixivAccount.connectionCode")}
									</Label>
									<Input
										id="pixiv-code"
										type="password"
										autocomplete="off"
										spellcheck={false}
										value={code()}
										onInput={(e) => setCode(e.currentTarget.value)}
										required
									/>
								</div>
								<Button
									type="button"
									variant="link"
									disabled={busy()}
									onClick={() => {
										setCode("");
										setUseCookie(!useCookie());
										account.setNotice("");
									}}
								>
									{useCookie()
										? t("pixivAccount.useConnectionCode")
										: t("pixivAccount.connectWithoutTheExtension")}
								</Button>
							</>
						}
					>
						{(connected) => (
							<p>
								{t("pixivAccount.pixivIDValue", {
									value0: String(connected().userId),
								})}
							</p>
						)}
					</Show>
					<Show when={account.notice()}>
						<p role="alert" class="text-sm text-destructive">
							{account.notice()}
						</p>
					</Show>
					<Button
						type="submit"
						disabled={busy() || (!account.session() && !code().trim())}
					>
						{busy()
							? t("status.processing")
							: account.session()
								? t("pixivAccount.logOutOfThisViewer")
								: t("pixivAccount.connect")}
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}
