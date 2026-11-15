import { t } from "../i18n";
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
				throw new Error(
					t("pixivConnection.setYourDestinationToHTTPSOrLocalhost"),
				);
			const cookie = await chrome.cookies.get({
				url: "https://www.pixiv.net/",
				name: "PHPSESSID",
			});
			if (!cookie)
				throw new Error(t("pixivConnection.logInToPixivInYourBrowser"));
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
					: t("pixivConnection.couldNotGenerateAConnectionCode"),
			);
		} finally {
			setBusy(false);
		}
	}
	return (
		<section
			class="popup-field"
			aria-label={t("pixivConnection.connectPixivAccount")}
		>
			<p class="popup-label">{t("pixivConnection.connectPixivAccount")}</p>
			<a
				href="https://accounts.pixiv.net/login"
				target="_blank"
				rel="noopener noreferrer"
			>
				{t("pixivAccount.logInOnPixiv")}
			</a>
			<p>
				{t("pixivConnection.pressTheButtonToSendYourPixivLoginSession", {
					value0: String(props.apiUrl),
				})}
			</p>
			<button
				type="button"
				class="popup-button popup-button-upload"
				disabled={busy()}
				onClick={() => void issue()}
			>
				{busy()
					? t("status.checking")
					: t("pixivConnection.generateViewerConnectionCode")}
			</button>
			<Show when={code()}>
				{(value) => (
					<label class="popup-label">
						{t("pixivConnection.connectionCodeForTheViewerValidFor5Minutes")}
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
