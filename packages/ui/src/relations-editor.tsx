import { t } from "@solid-imager/i18n";
import { getErrorMessage } from "@solid-imager/core/utils";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./alert-dialog";
import { Button } from "./button";
import { Checkbox, CheckboxControl, CheckboxLabel } from "./checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./dialog";
import { Input } from "./input";
import { toast } from "./toast";

type Item = { id: string; name: string };
type Group = {
	title: string;
	items: Item[];
	available: Item[];
	add: (id: string) => void | Promise<void>;
	remove: (id: string) => void | Promise<void>;
	create: (name: string) => Promise<{ id: string }>;
};
type Props = {
	groups: Group[];
	characterIps: (id: string) => string[];
	onUpdate?: () => void;
	disabled?: boolean;
};

export function RelationsEditor(props: Props) {
	const [open, setOpen] = createSignal(false);
	const [confirm, setConfirm] = createSignal(false);
	const [saving, setSaving] = createSignal(false);
	const [selected, setSelected] = createSignal<string[][]>([[], [], []]);
	const [newNames, setNewNames] = createSignal<string[][]>([[], [], []]);
	const [queries, setQueries] = createSignal<string[]>(["", "", ""]);
	const dirty = createMemo(() =>
		props.groups.some((group, i) => {
			const old = group.items.map((item) => item.id);
			return (
				newNames()[i].length > 0 ||
				old.length !== selected()[i].length ||
				old.some((id) => !selected()[i].includes(id))
			);
		}),
	);
	const begin = () => {
		setSelected(
			props.groups.map((group) => group.items.map((item) => item.id)),
		);
		setNewNames([[], [], []]);
		setQueries(["", "", ""]);
		setOpen(true);
	};
	const requestClose = () => {
		if (saving()) return;
		if (dirty()) setConfirm(true);
		else setOpen(false);
	};
	const toggle = (groupIndex: number, id: string, checked: boolean) => {
		setSelected((previous) => {
			const next = previous.map((ids) => [...ids]);
			next[groupIndex] = checked
				? [...next[groupIndex], id]
				: next[groupIndex].filter((value) => value !== id);
			if (groupIndex === 2 && checked)
				for (const ip of props.characterIps(id))
					if (!next[1].includes(ip)) next[1].push(ip);
			return next;
		});
	};
	const save = async () => {
		setSaving(true);
		try {
			for (const [i, group] of props.groups.entries()) {
				const old = group.items.map((item) => item.id);
				for (const id of old.filter((id) => !selected()[i].includes(id)))
					await group.remove(id);
				for (const id of selected()[i].filter((id) => !old.includes(id)))
					await group.add(id);
				for (const name of newNames()[i]) {
					const item = await group.create(name);
					await group.add(item.id);
				}
			}
			props.onUpdate?.();
			setOpen(false);
		} catch (error) {
			props.onUpdate?.();
			setOpen(false);
			toast.error(
				t("relationsEditor.failedToSaveRelationsSomeChangesMayHaveBeen", {
					value0: String(getErrorMessage(error)),
				}),
			);
		} finally {
			setSaving(false);
		}
	};
	return (
		<>
			<Button
				size="sm"
				variant="outline"
				disabled={props.disabled}
				onClick={begin}
			>
				{t("actions.edit")}
			</Button>
			<Dialog
				open={open()}
				onOpenChange={(value) => {
					if (!value) requestClose();
				}}
			>
				<DialogContent class="flex max-w-4xl flex-col gap-4 overflow-hidden">
					<DialogHeader>
						<DialogTitle>{t("relationsEditor.editRelations")}</DialogTitle>
						<DialogDescription>
							{t(
								"relationsEditor.selectProjectsIPsAndCharactersThenSaveTheChanges",
							)}
						</DialogDescription>
					</DialogHeader>
					<div class="grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain sm:grid-cols-3 sm:overflow-hidden">
						<For each={props.groups}>
							{(group, index) => {
								const i = index();
								const items = createMemo(() => {
									const unique = new Map(
										[...group.available, ...group.items].map((item) => [
											item.id,
											item,
										]),
									);
									const query = queries()[i].trim().toLowerCase();
									return [...unique.values()].filter((item) =>
										item.name.toLowerCase().includes(query),
									);
								});
								return (
									<section class="flex min-h-0 min-w-0 flex-col gap-2 rounded-md border p-3">
										<h3 class="font-semibold text-sm">{group.title}</h3>
										<Input
											aria-label={t("relationsEditor.searchValue", {
												value0: String(group.title),
											})}
											placeholder={t("relationsEditor.searchValue2", {
												value0: String(group.title.toLowerCase()),
											})}
											value={queries()[i]}
											onInput={(event) =>
												setQueries((old) =>
													old.map((v, n) =>
														n === i ? event.currentTarget.value : v,
													),
												)
											}
										/>
										<div class="space-y-2 sm:max-h-64 sm:min-h-0 sm:overflow-y-auto sm:overscroll-contain">
											<For each={items()}>
												{(item) => (
													<Checkbox
														class="flex items-center gap-2"
														checked={selected()[i].includes(item.id)}
														onChange={(checked) => toggle(i, item.id, checked)}
													>
														<CheckboxControl />
														<CheckboxLabel class="cursor-pointer text-sm">
															{item.name}
														</CheckboxLabel>
													</Checkbox>
												)}
											</For>
											<For each={newNames()[i]}>
												{(name) => (
													<div class="flex items-center justify-between gap-2 text-sm">
														<span>
															{t("relationsEditor.valueNew", {
																value0: String(name),
															})}
														</span>
														<Button
															size="sm"
															variant="outline"
															onClick={() =>
																setNewNames((old) =>
																	old.map((names, n) =>
																		n === i
																			? names.filter((value) => value !== name)
																			: names,
																	),
																)
															}
														>
															{t("actions.remove")}
														</Button>
													</div>
												)}
											</For>
											<Show
												when={
													items().length === 0 && newNames()[i].length === 0
												}
											>
												<p class="text-sm text-muted-foreground">
													{t("relationsEditor.noMatches")}
												</p>
											</Show>
										</div>
										<Show
											when={
												queries()[i].trim() &&
												!group.available.some(
													(item) =>
														item.name.toLowerCase() ===
														queries()[i].trim().toLowerCase(),
												) &&
												!newNames()[i].some(
													(name) =>
														name.toLowerCase() ===
														queries()[i].trim().toLowerCase(),
												)
											}
										>
											<Button
												size="sm"
												variant="outline"
												onClick={() => {
													const name = queries()[i].trim();
													setNewNames((old) =>
														old.map((names, n) =>
															n === i ? [...names, name] : names,
														),
													);
													setQueries((old) =>
														old.map((value, n) => (n === i ? "" : value)),
													);
												}}
											>
												{t("relationsEditor.createValue", {
													value0: String(queries()[i].trim()),
												})}
											</Button>
										</Show>
									</section>
								);
							}}
						</For>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							disabled={saving()}
							onClick={requestClose}
						>
							{t("actions.cancel")}
						</Button>
						<Button disabled={saving() || !dirty()} onClick={() => void save()}>
							{saving() ? t("status.saving") : t("actions.saveChanges")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<AlertDialog open={confirm()} onOpenChange={setConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("relationsEditor.discardChanges")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("relationsEditor.yourRelationChangesHaveNotBeenSaved")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("configScreen.keepEditing")}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setConfirm(false);
								setOpen(false);
							}}
						>
							{t("actions.discard")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
