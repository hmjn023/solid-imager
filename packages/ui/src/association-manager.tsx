import { t } from "@solid-imager/i18n";
import { getErrorMessage } from "@solid-imager/core/utils";
import { createMemo, createSignal, For, Show } from "solid-js";
import { Badge } from "./badge";
import { Button } from "./button";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "./command";
import { toast } from "./toast";

type Item = {
	id: string;
	name: string;
	description?: string | null;
};

type AssociationManagerProps = {
	title: string;
	items: Item[];
	availableItems: Item[];
	onAdd: (id: string) => void | Promise<void>;
	onRemove: (id: string) => void | Promise<void>;
	onCreate?: (name: string) => void | Promise<void>;
	isLoading?: boolean;
	editing?: boolean;
};

export function AssociationManager(props: AssociationManagerProps) {
	const [open, setOpen] = createSignal(false);
	const [search, setSearch] = createSignal("");
	const [isMutating, setIsMutating] = createSignal(false);
	const selectableItems = createMemo(() =>
		props.availableItems.filter(
			(item) => !props.items.some((candidate) => candidate.id === item.id),
		),
	);
	const isBusy = () => Boolean(props.isLoading) || isMutating();

	const handleRemove = async (id: string) => {
		setIsMutating(true);
		try {
			await props.onRemove(id);
		} catch (error) {
			toast.error(
				t("associationManager.couldNotRemoveValueValue", {
					value0: String(props.title),
					value1: String(getErrorMessage(error)),
				}),
			);
		} finally {
			setIsMutating(false);
		}
	};

	const handleAdd = async (id: string) => {
		setIsMutating(true);
		try {
			await props.onAdd(id);
			setSearch("");
		} catch (error) {
			toast.error(
				t("associationManager.couldNotAddValueValue", {
					value0: String(props.title),
					value1: String(getErrorMessage(error)),
				}),
			);
		} finally {
			setIsMutating(false);
		}
	};

	const handleCreate = async () => {
		const name = search().trim();
		if (!props.onCreate || name.length === 0) {
			return;
		}

		setIsMutating(true);
		try {
			await props.onCreate(name);
			setOpen(false);
			setSearch("");
		} catch (error) {
			toast.error(
				t("associationManager.couldNotCreateValueValue", {
					value0: String(props.title),
					value1: String(getErrorMessage(error)),
				}),
			);
		} finally {
			setIsMutating(false);
		}
	};

	return (
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<h2 class="font-semibold text-lg">{props.title}</h2>
				<Show when={props.editing}>
					<Button
						disabled={isMutating()}
						onClick={() => setOpen(true)}
						size="sm"
						variant="outline"
					>
						{t("actions.add")}
					</Button>
				</Show>
			</div>
			<div class="flex flex-wrap gap-2">
				<For each={props.items}>
					{(item) => (
						<Badge class="gap-1 pr-1" variant="secondary">
							{item.name}
							<button
								class="ml-1 rounded-full p-0.5 hover:bg-secondary-foreground/20"
								disabled={isBusy()}
								onClick={() => {
									void handleRemove(item.id);
								}}
								type="button"
							>
								<svg
									class="size-3"
									fill="none"
									stroke="currentColor"
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									viewBox="0 0 24 24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<title>{t("actions.remove")}</title>
									<path d="M18 6 6 18" />
									<path d="m6 6 12 12" />
								</svg>
								<span class="sr-only">{t("actions.remove")}</span>
							</button>
						</Badge>
					)}
				</For>
				<Show when={props.items.length === 0}>
					<span class="text-muted-foreground text-sm italic">
						{t("mediaSidebar.noValueAssociated", {
							value0: String(props.title.toLowerCase()),
						})}
					</span>
				</Show>
			</div>

			<CommandDialog onOpenChange={setOpen} open={open()}>
				<CommandInput
					disabled={isBusy()}
					onValueChange={setSearch}
					placeholder={t("relationsEditor.searchValue2", {
						value0: String(props.title.toLowerCase()),
					})}
					value={search()}
				/>
				<CommandList>
					<Show when={props.isLoading}>
						<div class="px-2 py-6 text-center text-muted-foreground text-sm">
							{t("associationManager.loadingValue", {
								value0: String(props.title.toLowerCase()),
							})}
						</div>
					</Show>
					<CommandEmpty>
						<Show when={props.onCreate && search().length > 0}>
							<div class="p-2">
								<p class="mb-2 text-muted-foreground text-sm">
									{t("associationManager.noValueFound", {
										value0: String(props.title.toLowerCase()),
									})}
								</p>
								<Button
									class="w-full justify-start"
									disabled={isBusy()}
									onClick={() => {
										void handleCreate();
									}}
									variant="outline"
								>
									{t("associationManager.createValue", {
										value0: String(search()),
									})}
								</Button>
							</div>
						</Show>
						<Show when={!props.onCreate || search().length === 0}>
							{t("associationManager.noValueFound", {
								value0: String(props.title.toLowerCase()),
							})}
						</Show>
					</CommandEmpty>
					<CommandGroup heading={t("associationManager.available")}>
						<For each={selectableItems()}>
							{(item) => (
								<CommandItem
									onSelect={() => {
										void handleAdd(item.id);
									}}
								>
									<div class="flex flex-col">
										<span>{item.name}</span>
										<Show when={item.description}>
											<span class="text-muted-foreground text-xs">
												{item.description}
											</span>
										</Show>
									</div>
								</CommandItem>
							)}
						</For>
					</CommandGroup>
				</CommandList>
			</CommandDialog>
		</div>
	);
}
