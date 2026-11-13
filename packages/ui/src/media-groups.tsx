import type { AppContractClient } from "@solid-imager/core/contract";
import {
	groupKindSchema,
	groupStateSchema,
	type MediaGroup,
	type GroupMember,
} from "@solid-imager/core/media";
import { t } from "@solid-imager/i18n";
import {
	createResource,
	createSignal,
	createUniqueId,
	For,
	Show,
} from "solid-js";
import { Button } from "./button";
import { Input } from "./input";

/** Shared Web/Tauri editor. Rejected membership remains available for explicit restoration. */
export function MediaGroups(props: {
	mediaId: string;
	client: AppContractClient["mediaGroups"];
}) {
	const id = createUniqueId();
	const [groups, { refetch }] = createResource(
		() => props.mediaId,
		(mediaId) => props.client.list({ mediaId }),
	);
	const [title, setTitle] = createSignal("");
	const [kind, setKind] = createSignal<MediaGroup["kind"]>("comic");
	const [members, setMembers] = createSignal<string[]>([]);
	const [query, setQuery] = createSignal("");
	const [matches, setMatches] = createSignal<MediaGroup[]>([]);
	const [busy, setBusy] = createSignal(false);
	const [message, setMessage] = createSignal("");
	async function run(action: () => Promise<unknown>) {
		if (busy()) return;
		setBusy(true);
		setMessage("");
		try {
			await action();
			await refetch();
			setMessage(t("mediaGroups.saved"));
		} catch (e) {
			setMessage(e instanceof Error ? e.message : t("mediaGroups.failed"));
		} finally {
			setBusy(false);
		}
	}
	return (
		<section
			class="space-y-4 rounded-md border p-4"
			aria-labelledby={`${id}-heading`}
		>
			<h2 id={`${id}-heading`} class="font-semibold">
				{t("mediaGroups.heading")}
			</h2>
			<p class="text-sm text-muted-foreground">{t("mediaGroups.help")}</p>
			<output>{message()}</output>
			<Show when={groups.error}>
				<p role="alert">{t("mediaGroups.failed")}</p>
				<Button type="button" onClick={() => void refetch()}>
					{t("actions.retry")}
				</Button>
			</Show>
			<Show when={groups.loading}>
				<output>{t("mediaGroups.loading")}</output>
			</Show>
			<For each={groups.error ? [] : groups()}>
				{(group) => (
					<div class="space-y-2 border-t pt-3">
						<h3 class="font-medium">
							{group.title} · {t(`mediaGroups.${group.kind}`)}
						</h3>
						<Show when={group.sourceKey}>
							<p class="text-sm text-muted-foreground">{group.sourceKey}</p>
						</Show>
						<ol class="space-y-2">
							<For each={group.members}>
								{(member) => (
									<li>
										<MemberEditor
											member={member}
											busy={busy()}
											onSave={(state, position) =>
												run(() =>
													props.client.setMember({
														groupId: group.id,
														mediaId: member.mediaId,
														state,
														position,
													}),
												)
											}
										/>
									</li>
								)}
							</For>
						</ol>
						<Button
							type="button"
							variant="outline"
							disabled={busy()}
							onClick={() => {
								setTitle(group.title);
								setKind("comic");
								setMembers(
									group.members
										.filter((m) => m.state !== "rejected")
										.map((m) => m.mediaId),
								);
								document.getElementById(`${id}-title`)?.focus();
							}}
						>
							{t("mediaGroups.useMembers")}
						</Button>
					</div>
				)}
			</For>
			<form
				aria-label={t("mediaGroups.create")}
				class="space-y-2"
				onSubmit={(e) => {
					e.preventDefault();
					void run(async () => {
						await props.client.create({
							title: title(),
							kind: kind(),
							state: "tentative",
							mediaIds: members().length ? members() : [props.mediaId],
						});
						setTitle("");
						setMembers([]);
					});
				}}
			>
				<label for={`${id}-title`}>{t("mediaGroups.title")}</label>
				<Input
					id={`${id}-title`}
					name="title"
					required
					maxLength={200}
					value={title()}
					onInput={(e) => setTitle(e.currentTarget.value)}
				/>
				<label for={`${id}-kind`}>{t("mediaGroups.kind")}</label>
				<select
					id={`${id}-kind`}
					name="kind"
					class="min-h-12 w-full rounded border bg-background p-2 text-base"
					value={kind()}
					onChange={(e) =>
						setKind(groupKindSchema.parse(e.currentTarget.value))
					}
				>
					<For each={groupKindSchema.options}>
						{(k) => <option value={k}>{t(`mediaGroups.${k}`)}</option>}
					</For>
				</select>
				<p class="text-sm">
					{t("mediaGroups.selected", { count: members().length || 1 })}
				</p>
				<Button type="submit" disabled={busy()}>
					{t("mediaGroups.create")}
				</Button>
				<Show when={members().length}>
					<Button
						type="button"
						variant="outline"
						onClick={() => setMembers([])}
					>
						{t("mediaGroups.onlyCurrent")}
					</Button>
				</Show>
			</form>
			<search>
				<form
					aria-label={t("mediaGroups.find")}
					class="space-y-2"
					onSubmit={(e) => {
						e.preventDefault();
						void run(async () =>
							setMatches(await props.client.list({ query: query() })),
						);
					}}
				>
					<label for={`${id}-query`}>{t("mediaGroups.find")}</label>
					<Input
						id={`${id}-query`}
						type="search"
						name="query"
						value={query()}
						onInput={(e) => setQuery(e.currentTarget.value)}
					/>
					<Button type="submit" disabled={busy()}>
						{t("actions.search")}
					</Button>
				</form>
			</search>
			<For each={matches()}>
				{(group) => (
					<div class="flex flex-wrap items-center gap-2">
						<span>
							{group.title} · {t(`mediaGroups.${group.kind}`)}
						</span>
						<Button
							type="button"
							variant="outline"
							disabled={
								busy() ||
								group.members.some(
									(m) => m.mediaId === props.mediaId && m.state !== "rejected",
								)
							}
							onClick={() =>
								void run(async () => {
									await props.client.setMember({
										groupId: group.id,
										mediaId: props.mediaId,
										state: "tentative",
										position: null,
									});
									setMatches([]);
								})
							}
						>
							{t("mediaGroups.join")}
						</Button>
					</div>
				)}
			</For>
		</section>
	);
}
function MemberEditor(props: {
	member: GroupMember;
	busy: boolean;
	onSave: (
		state: GroupMember["state"],
		position: number | null,
	) => Promise<void>;
}) {
	const id = createUniqueId();
	const [state, setState] = createSignal(props.member.state);
	const [position, setPosition] = createSignal(
		props.member.position === null ? "" : String(props.member.position + 1),
	);
	return (
		<form
			class="flex flex-wrap items-end gap-2 rounded border p-2"
			aria-label={props.member.fileName}
			onSubmit={(e) => {
				e.preventDefault();
				void props.onSave(
					state(),
					position() === "" ? null : Number(position()) - 1,
				);
			}}
		>
			<a
				class="w-full break-all text-primary underline"
				href={`/sources/${props.member.mediaSourceId}/${props.member.mediaId}`}
			>
				{props.member.fileName}
			</a>
			<span class="text-xs">{t(`mediaGroups.${props.member.origin}`)}</span>
			<div>
				<label for={`${id}-state`}>{t("mediaGroups.state")}</label>
				<select
					name="state"
					id={`${id}-state`}
					class="block min-h-12 rounded border bg-background p-2 text-base"
					value={state()}
					onChange={(e) =>
						setState(groupStateSchema.parse(e.currentTarget.value))
					}
				>
					<For each={groupStateSchema.options}>
						{(s) => <option value={s}>{t(`mediaGroups.${s}`)}</option>}
					</For>
				</select>
			</div>
			<div>
				<label for={`${id}-position`}>{t("mediaGroups.position")}</label>
				<Input
					id={`${id}-position`}
					name="position"
					class="w-24"
					type="number"
					min={1}
					max={100001}
					step={1}
					value={position()}
					onInput={(e) => setPosition(e.currentTarget.value)}
				/>
			</div>
			<Button type="submit" disabled={props.busy}>
				{t("actions.save")}
			</Button>
		</form>
	);
}
