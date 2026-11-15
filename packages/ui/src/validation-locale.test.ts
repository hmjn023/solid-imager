import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { configureClientValidationLocale } from "./validation-locale";

const originalConfig = { ...z.config() };
afterEach(() => {
	z.config(originalConfig);
	vi.unstubAllGlobals();
});

describe("validation language", () => {
	it("keeps SSR validation configuration request-independent", () => {
		const initial = z.config().localeError;
		configureClientValidationLocale("ja");
		expect(z.config().localeError).toBe(initial);
	});

	it("formats the same client-side constraint in the selected language", () => {
		vi.stubGlobal("document", {});
		const schema = z.number().min(1);
		configureClientValidationLocale("ja");
		const japanese = schema.safeParse(0).error?.issues[0].message ?? "";
		expect(japanese).toMatch(/[ぁ-んァ-ヶ一-龠]/);
		configureClientValidationLocale("en");
		const english = schema.safeParse(0).error?.issues[0].message ?? "";
		expect(english).toMatch(/[A-Za-z]/);
		expect(english).not.toMatch(/[ぁ-んァ-ヶ一-龠]/);
	});
});
