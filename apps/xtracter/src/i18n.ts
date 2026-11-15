import { z } from "zod";
import { en, ja } from "zod/locales";
import { createTranslator, type Locale } from "@solid-imager/i18n";

const STORAGE_KEY = "solid-imager.locale";
let locale: Locale = "ja";
export let t = createTranslator(locale);

export function getExtensionLocale(): Locale {
	return locale;
}

/** Content scripts and the service worker share the extension's preference, not the host site's storage. */
export async function initializeExtensionLocale(): Promise<Locale> {
	try {
		const stored = await chrome.storage.local.get(STORAGE_KEY);
		locale = stored[STORAGE_KEY] === "en" ? "en" : "ja";
	} catch {
		locale = "ja";
	}
	t = createTranslator(locale);
	z.config(locale === "ja" ? ja() : en());
	return locale;
}

export async function changeExtensionLocale(next: Locale): Promise<void> {
	await chrome.storage.local.set({ [STORAGE_KEY]: next });
	location.reload();
}
