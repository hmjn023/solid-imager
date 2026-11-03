import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
/** @typedef {{name: string, exports?: Record<string, unknown>, dependencies?: Record<string, string>, devDependencies?: Record<string, string>, optionalDependencies?: Record<string, string>, peerDependencies?: Record<string, string>}} Workspace */
/** @type {Map<string, Workspace>} */
const byDirectory = new Map();
/** @type {Map<string, Workspace>} */
const byName = new Map();
for (const group of ["apps", "packages"]) {
	for (const entry of readdirSync(path.join(root, group), {
		withFileTypes: true,
	})) {
		const directory = path.join(group, entry.name);
		const file = path.join(root, directory, "package.json");
		if (!entry.isDirectory() || !existsSync(file)) continue;
		// Workspaces are read from the same package manifests as the package manager.
		const manifest = /** @type {Workspace} */ (
			JSON.parse(readFileSync(file, "utf8"))
		);
		byDirectory.set(directory, manifest);
		byName.set(manifest.name, manifest);
	}
}

/** @param {string} file */
function ownerOf(file) {
	const [group, name] = path.relative(root, file).split(path.sep);
	return name ? byDirectory.get(path.join(group, name)) : undefined;
}

/** @type {Parameters<import("oxlint/plugins-dev").RuleTester["run"]>[1]} */
const boundary = {
	meta: { type: "problem" },
	create(context) {
		const filename = context.filename;
		const owner = ownerOf(filename);
		if (!owner) return {};

		/** @param {ReturnType<typeof context.sourceCode.getNodeByRangeIndex> | undefined} node */
		const check = (node) => {
			if (!node) return;
			let specifier;
			if (node.type === "Literal") specifier = node.value;
			if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
				specifier = node.quasis[0].value.cooked;
			}
			if (typeof specifier !== "string") return;
			const [source] = specifier.split(/[?#]/);
			if (source.startsWith(".") || path.isAbsolute(source)) {
				const target = ownerOf(path.resolve(path.dirname(filename), source));
				if (target !== owner) {
					context.report({
						node,
						message: target
							? `Import ${target.name} through a public entry instead of ${specifier}.`
							: `Importing ${specifier} escapes the ${owner.name} workspace.`,
					});
				}
				return;
			}

			const segments = source.split("/");
			const packageName = source.startsWith("@")
				? segments.slice(0, 2).join("/")
				: segments[0];
			const target = byName.get(packageName);
			if (!target) return;
			const entry = "." + source.slice(packageName.length);
			if (
				!Object.hasOwn(target.exports ?? {}, entry) ||
				!target.exports?.[entry]
			) {
				context.report({
					node,
					message: `${specifier} is not a public entry of ${packageName}.`,
				});
			} else if (
				target !== owner &&
				![
					owner.dependencies,
					owner.devDependencies,
					owner.peerDependencies,
					owner.optionalDependencies,
				].some((deps) => Object.hasOwn(deps ?? {}, packageName))
			) {
				context.report({
					node,
					message: `${owner.name} must declare its workspace dependency on ${packageName}.`,
				});
			}
		};

		return {
			ImportDeclaration: (node) => check(node.source),
			ExportNamedDeclaration: (node) => check(node.source),
			ExportAllDeclaration: (node) => check(node.source),
			ImportExpression: (node) => check(node.source),
			TSImportType: (node) => check(node.source),
			TSExternalModuleReference: (node) => check(node.expression),
			CallExpression(node) {
				const callee = node.callee;
				if (callee.type === "Identifier" && callee.name === "require")
					check(node.arguments[0]);
				if (
					callee.type === "MemberExpression" &&
					!callee.computed &&
					callee.object.type === "Identifier" &&
					callee.object.name === "require" &&
					callee.property.type === "Identifier" &&
					callee.property.name === "resolve"
				) {
					check(node.arguments[0]);
				}
			},
		};
	},
};

export default {
	meta: { name: "workspace" },
	rules: { "public-imports": boundary },
};
