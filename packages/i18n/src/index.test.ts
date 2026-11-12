import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "./en";
import { ja } from "./ja";
import { createTranslator } from "./index";
import { defineLocale, defineMessages } from "./schema";

function placeholders(text: string): string[] {
	return [
		...new Set([...text.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1])),
	].sort();
}

describe("translation contracts", () => {
	it("requires complete, nonempty catalogs with identical interpolation names", () => {
		expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
		for (const key of Object.keys(en) as (keyof typeof en)[]) {
			expect(en[key].trim(), key).not.toBe("");
			expect(ja[key].trim(), key).not.toBe("");
			expect(placeholders(ja[key]), key).toEqual(placeholders(en[key]));
		}
	});

	it("does not duplicate identical messages under different keys", () => {
		const seen = new Map<string, string>();
		for (const key of Object.keys(en) as (keyof typeof en)[]) {
			const signature = JSON.stringify([en[key], ja[key]]);
			expect(seen.get(signature), key).toBeUndefined();
			seen.set(signature, key);
		}
	});

	it("uses canonical labels for common operations", () => {
		expect(ja["actions.save"]).toBe("保存");
		expect(ja["actions.delete"]).toBe("削除");
		expect(ja["actions.cancel"]).toBe("キャンセル");
		for (const value of Object.values(ja)) {
			expect([
				"消去",
				"セーブ",
				"保存する",
				"削除する",
				"キャンセルする",
			]).not.toContain(value);
		}
		const commonActions = new Map(
			(Object.keys(en) as (keyof typeof en)[])
				.filter((key) => key.startsWith("actions."))
				.map((key) => [en[key], key]),
		);
		for (const key of Object.keys(en) as (keyof typeof en)[]) {
			// Keyboard legends name a physical key rather than the corresponding action.
			if (key.startsWith("keys.")) continue;
			const canonical = commonActions.get(en[key]);
			if (canonical) expect(key, en[key]).toBe(canonical);
		}
	});

	it("formats values literally, including zero and placeholder-like user content", () => {
		const translate = createTranslator("en");
		expect(translate("charts.valueItems", { value0: 0 })).toBe("0 items");
		expect(
			translate("searchToolbar.sortCurrentlyValue", { value0: "$& {value0}" }),
		).toBe("Sort, currently $& {value0}");
	});

	it("keeps explicit translators independent across SSR requests", () => {
		const english = createTranslator("en");
		const japanese = createTranslator("ja");
		expect(english("actions.save")).toBe("Save");
		expect(japanese("actions.save")).toBe("保存");
		expect(english("actions.save")).toBe("Save");
	});

	it("fails on missing keys or arguments instead of hiding missing translations", () => {
		const translate = createTranslator("en");
		expect(() => Reflect.apply(translate, undefined, ["missing.key"])).toThrow(
			"Missing translation",
		);
		expect(() =>
			Reflect.apply(translate, undefined, ["charts.valueItems"]),
		).toThrow("Missing translation parameter");
	});
});

describe("browser language preference", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it("restores the language before module-level labels are created and updates document language", async () => {
		vi.stubGlobal("document", { documentElement: { lang: "ja" } });
		vi.stubGlobal("localStorage", { getItem: () => "en" });
		vi.resetModules();
		const i18n = await import("./index");
		expect(i18n.t("navigation.settings")).toBe("Settings");
		expect(document.documentElement.lang).toBe("ja");
		expect(i18n.initializeBrowserLocale()).toBe("en");
		expect(document.documentElement.lang).toBe("en");
	});

	it("uses Japanese when storage is unavailable", async () => {
		vi.stubGlobal("document", { documentElement: { lang: "en" } });
		vi.stubGlobal("localStorage", {
			getItem: () => {
				throw new Error("blocked");
			},
		});
		vi.resetModules();
		const i18n = await import("./index");
		expect(i18n.initializeBrowserLocale()).toBe("ja");
		expect(i18n.t("actions.save")).toBe("保存");
	});

	it("persists language before reloading all application state", async () => {
		const setItem = vi.fn();
		const reload = vi.fn();
		vi.stubGlobal("localStorage", { setItem });
		vi.stubGlobal("location", { reload });
		const { changeLocale } = await import("./index");
		changeLocale("en");
		expect(setItem).toHaveBeenCalledWith("solid-imager.locale", "en");
		expect(reload).toHaveBeenCalledOnce();
	});

	it("does not reload when the preference cannot be saved", async () => {
		const reload = vi.fn();
		vi.stubGlobal("localStorage", {
			setItem: () => {
				throw new Error("blocked");
			},
		});
		vi.stubGlobal("location", { reload });
		const { changeLocale } = await import("./index");
		expect(() => changeLocale("en")).toThrow("blocked");
		expect(reload).not.toHaveBeenCalled();
	});
});

// Compile-only regression cases. This function is deliberately never invoked.
function checkTranslationTypes(): void {
	const translate = createTranslator("en");
	// @ts-expect-error Unknown message keys must fail.
	translate("missing.key");
	// @ts-expect-error Required interpolation values must be provided.
	translate("charts.valueItems");
	// @ts-expect-error Interpolation names must match the message.
	translate("charts.valueItems", { count: 1 });
	// @ts-expect-error Parameterless messages do not accept fallback text.
	translate("actions.save", { fallback: "Save" });
	// @ts-expect-error A locale may not omit a message.
	defineLocale({});
	// @ts-expect-error A locale may not change interpolation names.
	defineLocale({ ...en, "charts.valueItems": "{count}件" });
	// @ts-expect-error Empty translations are rejected.
	defineLocale({ ...en, "actions.save": "" });
	// @ts-expect-error Source messages may not be empty.
	defineMessages({ empty: "" });
	// @ts-expect-error Extra keys are rejected.
	defineLocale({ ...en, unexpected: "Unexpected" });
}
void checkTranslationTypes;
