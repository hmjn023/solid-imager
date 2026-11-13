import type { Locale } from "@solid-imager/i18n";
import { z } from "zod";
import { en, ja } from "zod/locales";

/** Configure client-side validation without changing the shared SSR process's locale. */
export function configureClientValidationLocale(locale: Locale): void {
	if (typeof document === "undefined") return;
	z.config(locale === "ja" ? ja() : en());
}
