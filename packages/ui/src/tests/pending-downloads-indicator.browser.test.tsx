import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import {
	PendingDownloadsIndicatorCore,
	PendingDownloadsProvider,
} from "../pending-downloads-indicator-core";
import { renderComponent } from "./render-component";

test("deduplicates pending import subscriptions and modal across multiple triggers", async ({
	onTestFinished,
}) => {
	const countPending = vi.fn(async () => 4);
	const subscribeImportEvents = vi.fn(
		(_handler: unknown, onConnected?: () => void) => {
			onConnected?.();
			return vi.fn();
		},
	);
	const renderModal = vi.fn((modalProps: { isOpen: boolean }) => (
		<div data-testid="shared-modal" data-open={String(modalProps.isOpen)} />
	));
	const sharedProps = {
		cancelPending: vi.fn(async () => ({ success: true })),
		countPending,
		listPending: vi.fn(async () => []),
		listSources: vi.fn(async () => []),
		processPending: vi.fn(async () => ({ success: true, processedCount: 0 })),
		renderFallback: () => null,
		renderModal,
		subscribeImportEvents,
	};

	onTestFinished(
		renderComponent(() => (
			<PendingDownloadsProvider>
				<PendingDownloadsIndicatorCore
					{...sharedProps}
					renderButton={({ onOpen, pendingCount }) => (
						<button onClick={onOpen} type="button">
							Desktop {pendingCount() ?? 0}
						</button>
					)}
				/>
				<PendingDownloadsIndicatorCore
					{...sharedProps}
					renderButton={({ onOpen, pendingCount }) => (
						<button onClick={onOpen} type="button">
							Mobile {pendingCount() ?? 0}
						</button>
					)}
				/>
			</PendingDownloadsProvider>
		)),
	);

	await expect
		.element(page.getByRole("button", { name: "Desktop 4" }))
		.toBeVisible();
	await expect
		.element(page.getByRole("button", { name: "Mobile 4" }))
		.toBeVisible();
	expect(subscribeImportEvents).toHaveBeenCalledTimes(1);
	expect(countPending).toHaveBeenCalledTimes(1);
	expect(renderModal).toHaveBeenCalledTimes(1);

	await page.getByRole("button", { name: "Mobile 4" }).click();
	await expect
		.element(page.getByTestId("shared-modal"))
		.toHaveAttribute("data-open", "true");
});
