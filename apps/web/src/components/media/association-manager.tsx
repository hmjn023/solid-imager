import { createSignal, For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "~/components/ui/command";

type Item = {
	id: string;
	name: string;
	description?: string | null;
};

type AssociationManagerProps = {
	title: string;
	items: Item[];
	availableItems: Item[];
	onAdd: (id: string) => void;
	onRemove: (id: string) => void;
	onCreate?: (name: string) => void;
	isLoading?: boolean;
};

export default function AssociationManager(props: AssociationManagerProps) {
	const [open, setOpen] = createSignal(false);
	const [search, setSearch] = createSignal("");

	return (
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<h2 class="font-semibold text-lg">{props.title}</h2>
				<Button
					disabled={props.isLoading}
					onClick={() => setOpen(true)}
					size="sm"
					variant="outline"
				>
					Add
				</Button>
			</div>
			<div class="flex flex-wrap gap-2">
				<For each={props.items}>
					{(item) => (
						<Badge class="gap-1 pr-1" variant="secondary">
							{item.name}
							<button
								class="ml-1 rounded-full p-0.5 hover:bg-secondary-foreground/20"
								disabled={props.isLoading}
								onClick={() => props.onRemove(item.id)}
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
									<title>Remove</title>
									<path d="M18 6 6 18" />
									<path d="m6 6 12 12" />
								</svg>
								<span class="sr-only">Remove</span>
							</button>
						</Badge>
					)}
				</For>
				<Show when={props.items.length === 0}>
					<span class="text-muted-foreground text-sm italic">
						No {props.title.toLowerCase()} associated
					</span>
				</Show>
			</div>

			<CommandDialog onOpenChange={setOpen} open={open()}>
				<CommandInput
					onValueChange={setSearch}
					placeholder={`Search ${props.title.toLowerCase()}...`}
					value={search()}
				/>
				<CommandList>
					<CommandEmpty>
						<Show when={props.onCreate && search().length > 0}>
							<div class="p-2">
								<p class="mb-2 text-muted-foreground text-sm">
									No {props.title.toLowerCase()} found.
								</p>
								<Button
									class="w-full justify-start"
									onClick={() => {
										props.onCreate?.(search());
										setOpen(false);
										setSearch("");
									}}
									variant="outline"
								>
									Create "{search()}"
								</Button>
							</div>
						</Show>
						<Show when={!props.onCreate || search().length === 0}>
							No {props.title.toLowerCase()} found.
						</Show>
					</CommandEmpty>
					<CommandGroup heading="Available">
						<For
							each={props.availableItems.filter(
								(item) => !props.items.some((i) => i.id === item.id),
							)}
						>
							{(item) => (
								<CommandItem
									onSelect={() => {
										props.onAdd(item.id);
										setOpen(false);
										setSearch("");
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
