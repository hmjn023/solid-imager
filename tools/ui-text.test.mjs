import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { RuleTester } from "oxlint/plugins-dev";
import plugin from "./ui-text.mjs";

RuleTester.describe = describe;
RuleTester.it = it;
const filename = fileURLToPath(
	new URL("../packages/ui/src/example.tsx", import.meta.url),
);
const valid = [
	'const node = <button>{t("actions.save")}</button>;',
	'const node = <input placeholder={t("search.hint")} aria-label={t("search.label")} />;',
	"const node = <div>{media.fileName}</div>;",
	'const node = <img alt="" src="/media.png" />;',
	'const node = <div class="flex gap-2" data-state="loading" />;',
	'const node = <Combobox optionLabel="name" optionTextValue="name" />;',
	'const options = [{ value: "image", label: t("media.image") }]; const node = <Select options={options} />;',
	'const node = <Select options={["asc", "desc"]} itemComponent={(item) => <span>{item.item.rawValue === "asc" ? t("sort.asc") : t("sort.desc")}</span>} />;',
	'const variants = cva("flex", { variants: { kind: { description: "text-muted-foreground" } } });',
	'const node = <span>{status === "running" ? t("jobs.running") : t("jobs.done")}</span>;',
	"const node = <span>{`${count} / ${total}`}</span>;",
	"const node = <div>{formatNumber(count)}</div>;",
	'toast.success(t("media.saved"));',
	'type State = "loading" | "error";',
	'const query = { phase: "error", error: null }; const node = <Result error={query.error} />;',
	'function request(message = { type: "GET_SOURCES" }) {}',
	'button.setAttribute("data-state", "loading");',
	'button.append(t("actions.save"), media.fileName);',
	'button.append(document.createElement("span"));',
	'const data = new FormData(); data.append("file", file);',
	'const params = new URLSearchParams(); params.append("sort", "desc");',
	'button.insertAdjacentText("beforeend", t("actions.save"));',
].map((code) => ({ filename, code }));
const invalid = [
	'button.append("Save");',
	'const value = "Save"; button.prepend(value);',
	'document.createTextNode("Save");',
	'button.replaceChildren("Save");',
	'button.before("Save");',
	'button.after("Save");',
	'button.replaceWith("Save");',
	'button.insertAdjacentText("beforeend", "Save");',
	"<button>Save</button>;",
	"<button>保存</button>;",
	'<input placeholder="Search..." />;',
	'<button aria-label="Delete" />;',
	'<button title="Edit" />;',
	'<img alt="Import preview" />;',
	'<span>{"Pending"}</span>;',
	'<span>{ready ? "Ready" : ""}</span>;',
	"<span>{`${count} items`}</span>;",
	'const caption = "Save"; const node = <button>{caption}</button>;',
	'const first = "Save"; const second = first; const node = <button>{second}</button>;',
	'const caption = () => "Save"; const node = <button>{caption()}</button>;',
	'function caption() { return "Save"; } const node = <button>{caption()}</button>;',
	'const menu = [{ label: "Delete", value: "delete" }];',
	'const ratings = ["Unrated"]; const node = <Select options={ratings} />;',
	'const ratings = ["Unrated"]; const node = <Select options={ratings} itemComponent={(item) => <span>{item.item.rawValue}</span>} />;',
	'<Show when={value} fallback="Never">{value}</Show>;',
	'toast.error("Could not save");',
	'state.setRequestMessage(request, "Ready");',
	'state.failRead(jobId, "Could not load progress");',
	'toast.promise(save(), { loading: "Saving", success: "Saved" });',
	'setUploadStatus("Uploading...");',
	'setErrorMsg("Could not save");',
	'const options = [{ id: "all", name: "All sources" }];',
	'<Result error="Could not load" />',
	'const result = { messages: ["Invalid value"] };',
	'function validateUrl(value) { try { return "Use HTTPS"; } catch { return null; } }',
	'const node = <Dialog confirmLabel="Delete" />;',
	'function field({ placeholder = "Search" }) {}',
	'throw new Error("Could not load media");',
	'button.textContent = "Import";',
	'button.setAttribute("aria-label", "Import");',
	'function statusLabel(status) { return { pending: "Waiting" }[status]; }',
	'requireField("name", "Name is required");',
	'const schema = z.string().min(1, "Name is required");',
].map((code) => ({
	filename,
	code,
	errors: code.startsWith("toast.promise")
		? [/Move UI text/, /Move UI text/]
		: [/Move UI text/],
}));
new RuleTester().run("ui-text/no-raw-text", plugin.rules["no-raw-text"], {
	valid: [
		...valid,
		{
			filename: path.join(path.dirname(filename), "sample.test.tsx"),
			code: "<button>Fixture</button>;",
		},
		{
			filename: fileURLToPath(
				new URL(
					"../apps/server/src/infrastructure/example.ts",
					import.meta.url,
				),
			),
			code: 'throw new Error("Internal failure");',
		},
	],
	invalid,
});
