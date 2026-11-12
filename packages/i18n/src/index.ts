import { en } from "./en";
import { ja } from "./ja";

import type { Locale, MessageArguments, MessageKey } from "./schema";
export type { Locale, MessageKey, StaticMessageKey } from "./schema";

const LOCALE_STORAGE_KEY = "solid-imager.locale";
function readBrowserLocale(): Locale {
	if (typeof document === "undefined") return "ja";
	try {
		return localStorage.getItem(LOCALE_STORAGE_KEY) === "en" ? "en" : "ja";
	} catch {
		return "ja";
	}
}

// A browser session has one immutable locale. SSR never reads or mutates client preferences.
const browserLocale = readBrowserLocale();

export function getLocale(): Locale {
	return browserLocale;
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
	return translators[browserLocale](key, ...args);
}
