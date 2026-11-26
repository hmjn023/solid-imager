import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import {
	PendingDownloadsIndicatorCore,
	PendingDownloadsProvider,
} from "../pending-downloads-indicator-core";
import { createSignal, Show } from "solid-js";
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

test("ignores a count from the previous subscription owner after an ownership change", async ({
	onTestFinished,
}) => {
	const previousCount = Promise.withResolvers<number>();
	const countPending = vi
		.fn()
		.mockReturnValueOnce(previousCount.promise)
		.mockResolvedValueOnce(7);
	const [showFirst, setShowFirst] = createSignal(true);
	const props = {
		cancelPending: async () => ({ success: true }),
		countPending,
		listPending: async () => [],
		listSources: async () => [],
		processPending: async () => ({ success: true, processedCount: 0 }),
		renderFallback: () => null,
		renderModal: () => null,
		subscribeImportEvents: (
			_handler: unknown,
			onConnected?: () => void | Promise<void>,
		) => {
			void onConnected?.();
			return () => {};
		},
	};
	onTestFinished(
		renderComponent(() => (
			<PendingDownloadsProvider>
				<Show when={showFirst()}>
					<PendingDownloadsIndicatorCore {...props} renderButton={() => null} />
				</Show>
				<PendingDownloadsIndicatorCore
					{...props}
					renderButton={({ pendingCount }) => <output>{pendingCount()}</output>}
				/>
			</PendingDownloadsProvider>
		)),
	);
	await vi.waitFor(() => expect(countPending).toHaveBeenCalledTimes(1));
	setShowFirst(false);
	const count = page.getByRole("status");
	await expect.element(count).toHaveTextContent("7");
	previousCount.resolve(2);
	await previousCount.promise;
	expect(count.element().textContent).toBe("7");
});
