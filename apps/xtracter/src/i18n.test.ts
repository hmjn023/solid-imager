import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe("extension language preference", () => {
	it("shares the extension preference across popup and worker contexts without changing the host document", async () => {
		vi.stubGlobal("chrome", {
			storage: {
				local: {
					get: vi.fn().mockResolvedValue({ "solid-imager.locale": "en" }),
				},
			},
		});
		vi.stubGlobal("document", { documentElement: { lang: "fr" } });
		vi.stubGlobal("localStorage", { getItem: () => "ja" });
		const i18n = await import("./i18n");
		expect(await i18n.initializeExtensionLocale()).toBe("en");
		expect(i18n.t("actions.save")).toBe("Save");
		expect(i18n.getExtensionLocale()).toBe("en");
		expect(document.documentElement.lang).toBe("fr");
	});

	it("keeps working in Japanese when storage is unavailable", async () => {
		vi.stubGlobal("chrome", {
			storage: {
				local: { get: vi.fn().mockRejectedValue(new Error("unavailable")) },
			},
		});
		const i18n = await import("./i18n");
		expect(await i18n.initializeExtensionLocale()).toBe("ja");
		expect(i18n.t("actions.save")).toBe("保存");
	});

	it("saves to extension storage before reloading the popup", async () => {
		const set = vi.fn().mockResolvedValue(undefined);
		const reload = vi.fn();
		vi.stubGlobal("chrome", { storage: { local: { set } } });
		vi.stubGlobal("location", { reload });
		const { changeExtensionLocale } = await import("./i18n");
		await changeExtensionLocale("en");
		expect(set).toHaveBeenCalledWith({ "solid-imager.locale": "en" });
		expect(reload).toHaveBeenCalledOnce();
	});
});
