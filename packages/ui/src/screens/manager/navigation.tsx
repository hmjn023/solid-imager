import Bot from "lucide-solid/icons/bot";
import CopyCheck from "lucide-solid/icons/copy-check";
import Folder from "lucide-solid/icons/folder";
import Image from "lucide-solid/icons/image";
import Share2 from "lucide-solid/icons/share-2";
import { For } from "solid-js";
import { Button } from "../../button";
import { CategoryButtonClass, CategoryLabel } from "../../management-layout";
import { MANAGER_CATEGORIES, type ManagerCategory } from "./types";

function ManagerCategoryIcon(props: { value: ManagerCategory }) {
	switch (props.value) {
		case "projects":
			return <Folder aria-hidden="true" size={16} />;
		case "ips":
			return <CopyCheck aria-hidden="true" size={16} />;
		case "characters":
			return <Image aria-hidden="true" size={16} />;
		case "tagging":
			return <Bot aria-hidden="true" size={16} />;
		case "vectors":
			return <Share2 aria-hidden="true" size={16} />;
		case "thumbnails":
			return <Image aria-hidden="true" size={16} />;
		case "duplicates":
			return <CopyCheck aria-hidden="true" size={16} />;
		case "transfer":
			return <Share2 aria-hidden="true" size={16} />;
	}
}

export function ManagerCategoryNavigation(props: {
	active: ManagerCategory;
	compact?: boolean;
	onChange: (value: ManagerCategory) => void;
}) {
	if (props.compact) {
		return (
			<nav
				aria-label="Manager categories"
				class="sticky top-0 z-10 flex gap-1 overflow-x-auto border-[var(--app-border)] border-b bg-[var(--app-canvas)]/95 px-3 py-2 backdrop-blur lg:hidden"
			>
				<For each={MANAGER_CATEGORIES}>
					{(category) => (
						<Button
							aria-current={
								props.active === category.value ? "page" : undefined
							}
							class={`min-h-11 shrink-0 gap-2.5 px-2.5 ${
								props.active === category.value
									? "bg-[var(--app-surface-selected)] text-[var(--app-primary)]"
									: "text-[var(--app-text-secondary)]"
							}`}
							onClick={() => props.onChange(category.value)}
							variant="ghost"
						>
							<CategoryLabel
								description={category.description}
								icon={<ManagerCategoryIcon value={category.value} />}
								label={category.label}
							/>
						</Button>
					)}
				</For>
			</nav>
		);
	}

	return (
		<nav aria-label="Manager categories" class="hidden lg:block">
			<div class="sticky top-5 space-y-5">
				<For each={["Entities", "Tools"] as const}>
					{(group) => (
						<div>
							<p class="mb-1 px-2.5 font-medium text-[10px] uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
								{group}
							</p>
							<div class="space-y-0.5">
								<For
									each={MANAGER_CATEGORIES.filter(
										(category) => category.group === group,
									)}
								>
									{(category) => (
										<button
											aria-current={
												props.active === category.value ? "page" : undefined
											}
											class={CategoryButtonClass(
												props.active === category.value,
											)}
											onClick={() => props.onChange(category.value)}
											type="button"
										>
											<CategoryLabel
												description={category.description}
												icon={<ManagerCategoryIcon value={category.value} />}
												label={category.label}
											/>
										</button>
									)}
								</For>
							</div>
						</div>
					)}
				</For>
			</div>
		</nav>
	);
}
