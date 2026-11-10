import { createClient } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/contract";
import { canTransferPixivSession } from "@solid-imager/core/external-viewer";
import { createSignal, Show } from "solid-js";

export function PixivConnection(props: { apiUrl: string }) {
	const [code, setCode] = createSignal("");
	const [message, setMessage] = createSignal("");
	const [busy, setBusy] = createSignal(false);
	async function issue() {
		setBusy(true);
		setMessage("");
		setCode("");
		try {
			const server = new URL(props.apiUrl);
			if (!canTransferPixivSession(server))
				throw new Error("接続先を HTTPS または localhost に設定してください。");
			const cookie = await chrome.cookies.get({
				url: "https://www.pixiv.net/",
				name: "PHPSESSID",
			});
			if (!cookie)
				throw new Error("ブラウザーで pixiv にログインしてください。");
			const client = createClient<AppContract>({
				url: server.href,
				fetch: (url, init) =>
					fetch(url, { ...init, redirect: "error", cache: "no-store" }),
			});
			const result = await client.viewer.issuePixivCode({
				sessionId: cookie.value,
			});
			setCode(result.code);
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "接続コードを発行できませんでした。",
			);
		} finally {
			setBusy(false);
		}
	}
	return (
		<section class="popup-field" aria-label="pixiv アカウント接続">
			<p class="popup-label">pixiv アカウント接続</p>
			<a
				href="https://accounts.pixiv.net/login"
				target="_blank"
				rel="noopener noreferrer"
			>
				公式 pixiv でログイン ↗
			</a>
			<p>
				ボタンを押すと pixiv のログインセッションを {props.apiUrl}{" "}
				に送信します。
			</p>
			<button
				type="button"
				class="popup-button popup-button-upload"
				disabled={busy()}
				onClick={() => void issue()}
			>
				{busy() ? "確認中…" : "Viewer の接続コードを発行"}
			</button>
			<Show when={code()}>
				{(value) => (
					<label class="popup-label">
						Viewer に入力する接続コード（5 分間有効）
						<input
							class="popup-control"
							readonly
							value={value()}
							onFocus={(e) => e.currentTarget.select()}
						/>
					</label>
				)}
			</Show>
			<Show when={message()}>
				<p class="popup-status-error" role="alert">
					{message()}
				</p>
			</Show>
		</section>
	);
}
