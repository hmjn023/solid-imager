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
				setNotice("pixiv のログインが切れました。再接続してください。");
			}
			return response;
		};
		return {
			viewer: createViewer(base, request),
			async animation(id: number) {
				const res = await request(
					new URL("/api/pixiv-animation/" + id, base).href,
				);
				if (!res.ok) throw new Error("うごイラを取得できませんでした。");
				return URL.createObjectURL(await res.blob());
			},
		};
	});
	function save(next: PixivViewerSession | undefined) {
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
			if (!current) return;
			void transport()
				.viewer.checkPixivSession()
				.then(() => {
					if (session() === current) setNotice("");
				})
				.catch(() => {
					if (session() === current)
						setNotice("pixiv との接続を確認できませんでした。");
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
				setNotice("pixiv の接続期限が切れました。");
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
				throw new Error(
					"接続には HTTPS または localhost のサーバーを指定してください。",
				);
			const viewer = transport().viewer;
			let code = value.trim();
			if (useCookie) {
				const credential = pixivWebSessionSchema.safeParse(code);
				if (!credential.success)
					throw new Error("PHPSESSID の値を確認してください。");
				code = (await viewer.issuePixivCode({ sessionId: credential.data }))
					.code;
			}
			const input = pixivCodeSchema.safeParse({ code });
			if (!input.success)
				throw new Error("xtracter に表示された接続コードを入力してください。");
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
				error instanceof Error ? error.message : "接続を変更できませんでした。",
			);
		} finally {
			setBusy(false);
		}
	}
	return (
		<Dialog open={open()} onOpenChange={close}>
			<DialogTrigger as={Button} variant="outline" size="sm">
				{account.session()
					? "pixiv ID " + account.session()?.userId
					: "pixiv にログイン"}
			</DialogTrigger>
			<DialogContent class="workspace-theme">
				<DialogTitle>pixiv アカウント</DialogTitle>
				<DialogDescription>
					{account.session()
						? "このタブの Viewer で使用中のアカウントです。"
						: "公式 pixiv でログインしたアカウントをこのタブに接続します。"}
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
								<a
									class={buttonVariants({ variant: "outline" })}
									href="https://accounts.pixiv.net/login"
									target="_blank"
									rel="noopener noreferrer"
								>
									公式 pixiv でログイン ↗
								</a>
								<p class="break-all text-sm text-muted-foreground">
									{useCookie()
										? "ブラウザーの Cookie にある PHPSESSID を入力すると、ログインセッションを " +
											account.base +
											" に送信します。"
										: "xtracter 拡張で接続先を " +
											account.base +
											" に設定し、接続コードを発行してください。"}
								</p>
								<div class="grid gap-2">
									<Label for="pixiv-code">
										{useCookie() ? "PHPSESSID" : "接続コード"}
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
									{useCookie() ? "接続コードを使う" : "拡張機能を使わずに接続"}
								</Button>
							</>
						}
					>
						{(connected) => <p>pixiv ID {connected().userId}</p>}
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
							? "処理中…"
							: account.session()
								? "この Viewer からログアウト"
								: "接続する"}
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}
