import { createSignal } from "solid-js";
import { Button } from "./ui/button";

/**
 * A simple modal component that can be opened and closed.
 * It demonstrates basic modal functionality with a button to open it.
 * @returns {JSX.Element} The rendered modal component and its trigger button.
 */
export default function SimpleModal() {
	const [isOpen, setIsOpen] = createSignal(false);

	const handleClick = () => {
		// ボタンがクリックされました - ここにアナリティクスを追加できます。
		setIsOpen(true);
	};

	return (
		<>
			<Button onClick={handleClick}>Open Simple Modal</Button>

			{isOpen() && (
				<div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
					<div class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
						<h2 class="mb-4 font-bold text-xl">Simple Modal</h2>
						<p class="mb-4">This is a simple modal for testing.</p>
						<div class="flex justify-end gap-2">
							<Button onClick={() => setIsOpen(false)} variant="outline">
								Close
							</Button>
							<Button onClick={() => setIsOpen(false)}>OK</Button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
