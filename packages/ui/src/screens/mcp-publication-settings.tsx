import type { McpConfig, McpToolInfo } from "@solid-imager/core/config";
import { createQuery } from "@tanstack/solid-query";
import { createSignal, For, Show } from "solid-js";
import { Checkbox, CheckboxControl, CheckboxLabel } from "../checkbox";
import { Input } from "../input";
import { Button } from "../button";
import { configQueryKeys } from "../query-options/config-query";

type Props = {
	value: McpConfig;
	onChange: (value: McpConfig) => void;
	loadCatalog: () => Promise<McpToolInfo[]>;
};

export function McpPublicationSettings(props: Props) {
	const [filter, setFilter] = createSignal("");
	const catalog = createQuery(() => ({
		queryKey: [...configQueryKeys.all(), "mcpCatalog"],
		queryFn: props.loadCatalog,
	}));
	const matches = () =>
		(catalog.data ?? []).filter((tool) =>
			[tool.name, tool.title, tool.group]
				.join(" ")
				.toLowerCase()
				.includes(filter().trim().toLowerCase()),
		);
	const setPublished = (
		surface: keyof McpConfig,
		name: string,
		enabled: boolean,
	) => {
		const names = new Set(props.value[surface]);
		if (enabled) names.add(name);
		else names.delete(name);
		props.onChange({ ...props.value, [surface]: [...names] });
	};
	return (
		<fieldset class="min-w-0 space-y-4">
			<legend class="font-semibold">MCP ツールの公開設定</legend>
			<p class="text-sm text-muted-foreground">
				外部クライアント向けの HTTP MCP と、ブラウザーの WebMCP
				に公開する操作を選択します。
			</p>
			<Input
				aria-label="ツールを絞り込む"
				placeholder="ツール名・説明で絞り込み"
				value={filter()}
				onInput={(e) => setFilter(e.currentTarget.value)}
			/>
			<Show when={catalog.isPending}>
				<output>公開候補を読み込み中…</output>
			</Show>
			<Show when={catalog.isError}>
				<p role="alert">
					公開候補を取得できませんでした。{" "}
					<Button
						type="button"
						variant="outline"
						onClick={() => void catalog.refetch()}
					>
						再試行
					</Button>
				</p>
			</Show>
			<Show when={catalog.isSuccess && matches().length === 0}>
				<p>該当するツールはありません。</p>
			</Show>
			<For each={matches()}>
				{(tool) => (
					<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm">
						<div class="min-w-0">
							<div class="break-all font-medium">{tool.name}</div>
							<div class="text-muted-foreground">{tool.title}</div>
						</div>
						<div class="flex flex-wrap gap-4">
							<For
								each={
									tool.webOnly ? (["web"] as const) : (["http", "web"] as const)
								}
							>
								{(surface) => (
									<Checkbox
										class="flex items-center gap-2"
										checked={props.value[surface].includes(tool.name)}
										onChange={(enabled) =>
											setPublished(surface, tool.name, enabled)
										}
									>
										<CheckboxControl />
										<CheckboxLabel>
											{surface === "http" ? "HTTP MCP" : "WebMCP"}
											<span class="sr-only"> {tool.name}</span>
										</CheckboxLabel>
									</Checkbox>
								)}
							</For>
						</div>
					</div>
				)}
			</For>
		</fieldset>
	);
}
