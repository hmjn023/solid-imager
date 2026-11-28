import { t } from "@solid-imager/i18n";
import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createAppShortcut } from "../shortcuts/create-app-shortcut";
import { ShortcutPreferencesProvider } from "../shortcuts/preferences-provider";
import { SHORTCUT_PREFERENCES_STORAGE_KEY } from "../shortcuts/preferences-storage";
import { ShortcutSettingsPanel } from "../shortcuts/shortcut-settings-panel";
import { renderComponent } from "./render-component";

function GridShortcut(props: { onTrigger: () => void }) {
	createAppShortcut("viewGrid", () => props.onTrigger());
	return null;
}

test("rejects a conflicting shortcut and applies the replacement across mounts", async ({
	onTestFinished,
}) => {
	const savedPreferences = localStorage.getItem(
		SHORTCUT_PREFERENCES_STORAGE_KEY,
	);
	let dispose: (() => void) | undefined;
	onTestFinished(() => {
		dispose?.();
		if (savedPreferences === null) {
			localStorage.removeItem(SHORTCUT_PREFERENCES_STORAGE_KEY);
		} else {
			localStorage.setItem(SHORTCUT_PREFERENCES_STORAGE_KEY, savedPreferences);
		}
	});
	localStorage.removeItem(SHORTCUT_PREFERENCES_STORAGE_KEY);

	const onGrid = vi.fn();
	const mountSettings = () =>
		renderComponent(() => (
			<ShortcutPreferencesProvider>
				<ShortcutSettingsPanel />
				<GridShortcut onTrigger={onGrid} />
			</ShortcutPreferencesProvider>
		));
	dispose = mountSettings();
	const gridLabel = t("actions.gridView");
	const listLabel = t("actions.listView");
	const gridBinding = page.getByRole("textbox", {
		name: gridLabel,
		exact: true,
	});
	const listBinding = page.getByRole("textbox", {
		name: listLabel,
		exact: true,
	});
	const heading = page.getByRole("heading", {
		name: t("configScreen.keyboardShortcuts"),
		exact: true,
	});
	const feedback = page.getByRole("status");
	const pressNonConvert = (target: Element) => {
		const options = {
			key: "NonConvert",
			code: "NonConvert",
			bubbles: true,
			cancelable: true,
		};
		target.dispatchEvent(new KeyboardEvent("keydown", options));
		target.dispatchEvent(new KeyboardEvent("keyup", options));
	};
	await expect.element(gridBinding).toHaveValue("1");
	await expect.element(listBinding).toHaveValue("2");
	gridBinding.element().focus();
	await userEvent.keyboard("{Enter}");
	await expect
		.element(feedback)
		.toHaveTextContent(
			t("shortcutSettingsPanel.recordingPressTheNewShortcutEscapeToCancelOr"),
		);
	await userEvent.keyboard("2");
	await expect.element(feedback).toHaveTextContent(
		t(
			"shortcutSettingsPanel.conflictValueIsAlreadyAssignedToValueTheShortcut",
			{
				value0: "2",
				value1: listLabel,
			},
		),
	);
	await expect.element(gridBinding).toHaveAttribute("aria-invalid", "true");
	await expect.element(gridBinding).toHaveValue("1");
	await expect.element(listBinding).toHaveValue("2");

	await gridBinding.click();
	pressNonConvert(gridBinding.element());
	await expect.element(gridBinding).toHaveValue("NonConvert");
	await expect.element(gridBinding).not.toHaveAttribute("aria-invalid");
	await expect.element(feedback).toHaveTextContent(
		t("shortcutSettingsPanel.valueWasUpdatedForThisDevice", {
			value0: gridLabel,
		}),
	);
	await heading.click();
	await userEvent.keyboard("1");
	expect(onGrid).not.toHaveBeenCalled();
	pressNonConvert(heading.element());
	expect(onGrid).toHaveBeenCalledTimes(1);

	dispose();
	dispose = mountSettings();
	await expect.element(gridBinding).toHaveValue("NonConvert");
	await heading.click();
	pressNonConvert(heading.element());
	expect(onGrid).toHaveBeenCalledTimes(2);
});
