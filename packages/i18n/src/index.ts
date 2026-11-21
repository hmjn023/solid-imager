import { en } from "./en";
import { ja } from "./ja";

import type { Locale, MessageArguments, MessageKey } from "./schema";
export type { Locale, MessageKey, StaticMessageKey } from "./schema";

const LOCALE_STORAGE_KEY = "solid-imager.locale";

function parseLocale(value: string | null | undefined): Locale | undefined {
	return value === "ja" || value === "en" ? value : undefined;
}

export function readLocaleCookie(cookies: string): Locale | undefined {
	const prefix = `${LOCALE_STORAGE_KEY}=`;
	const cookie = cookies
		.split(";")
		.find((value) => value.trimStart().startsWith(prefix));
	return parseLocale(cookie?.trim().slice(prefix.length));
}

function readStoredLocale(): Locale | undefined {
	try {
		return parseLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
	} catch {
		return undefined;
	}
}

function isServerRenderedDocument(): boolean {
	return (
		typeof document !== "undefined" &&
		document.documentElement?.dataset?.serverRendered !== undefined
	);
}

function readBrowserLocale(): Locale {
	if (isServerRenderedDocument())
		return parseLocale(document.documentElement.lang) ?? "ja";
	return typeof document === "undefined" ? "ja" : (readStoredLocale() ?? "ja");
}

let browserLocale = readBrowserLocale();
let readRequestLocale: (() => Locale | undefined) | undefined;

export function configureRequestLocale(reader: () => Locale | undefined): void {
	readRequestLocale = reader;
}

export function getLocale(): Locale {
	return readRequestLocale?.() ?? browserLocale;
}

function synchronizeLocaleCookie(locale: Locale): boolean {
	try {
		if (readLocaleCookie(document.cookie) === locale) return true;
		const secure = location.protocol === "https:" ? "; Secure" : "";
		document.cookie = `${LOCALE_STORAGE_KEY}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
		return readLocaleCookie(document.cookie) === locale;
	} catch {
		return false;
	}
}

/** Preserve the language selected before the web app started using a cookie. */
export function migrateBrowserLocale(): boolean {
	const locale = readStoredLocale();
	if (!locale) return false;
	if (synchronizeLocaleCookie(locale)) return locale !== browserLocale;
	browserLocale = locale;
	return false;
}

/** Synchronize document language after hydration, or before rendering a standalone SPA. */
export function initializeBrowserLocale(): Locale {
	if (typeof document !== "undefined")
		document.documentElement.lang = browserLocale;
	return browserLocale;
}

/** Reload so module-level options, active dialogs and third-party controls use one locale together. */
export function changeLocale(locale: Locale): void {
	localStorage.setItem(LOCALE_STORAGE_KEY, locale);
	if (isServerRenderedDocument()) synchronizeLocaleCookie(locale);
	location.reload();
}

export function createTranslator(locale: Locale) {
	const dictionary = locale === "en" ? en : ja;
	return function translate<Key extends MessageKey>(
		key: Key,
		...args: MessageArguments<Key>
	): string {
		const template: string = dictionary[key];
		if (typeof template !== "string" || template.length === 0) {
			throw new Error(`Missing translation: ${locale}:${key}`);
		}
		const parameters: Record<string, string | number> | undefined = args[0];
		return template.replace(/\{([^{}]+)\}/g, (_match, parameter: string) => {
			if (!parameters || !Object.hasOwn(parameters, parameter)) {
				throw new Error(`Missing translation parameter: ${key}:${parameter}`);
			}
			return String(parameters[parameter]);
		});
	};
}

const translators = { ja: createTranslator("ja"), en: createTranslator("en") };

export function t<Key extends MessageKey>(
	key: Key,
	...args: MessageArguments<Key>
): string {
	return translators[getLocale()](key, ...args);
}
