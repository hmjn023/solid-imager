/** UI copy must come from the shared, typed dictionaries, including indirect local constants. */
/** @type {Parameters<import("oxlint/plugins-dev").RuleTester["run"]>[1]} */
const noRawText = {
	meta: { type: "problem" },
	create(context) {
		const file = context.filename.replaceAll("\\", "/");
		if (
			!/(?:packages\/ui\/src\/|apps\/tauri\/src\/(?:components\/|hooks\/|routes\/|main\.tsx$)|apps\/xtracter\/src\/|apps\/server\/src\/(?:components|hooks|presentation|routes)\/)/.test(
				file,
			) ||
			/(?:\.test\.|\.spec\.|\/tests\/|\/__mocks__\/|routeTree\.gen\.ts$|\/routes\/(?:api|docs)\/)/.test(
				file,
			)
		)
			return {};

		// The design lab is a static design reference rather than a localized product surface.
		if (file.endsWith("/screens/design-concept-screen.tsx")) return {};
		const displayName =
			/^(?:aria-label|aria-description|alt|title|label|description|placeholder|fallback|message|messages|error|heading|caption|text|(?:.*)(?:Label|Placeholder|Message|Title|Description|Text|Error|Errors|Msg))$/;
		const reported = new Set();
		/** @typedef {NonNullable<ReturnType<typeof context.sourceCode.getNodeByRangeIndex>>} Node */
		/** @param {Node} node */
		const nameOf = (node) =>
			node.type === "Identifier" || node.type === "JSXIdentifier"
				? node.name
				: node.type === "Literal" && typeof node.value === "string"
					? node.value
					: "";
		/** @param {Node} node @param {string} text */
		const report = (node, text) => {
			if (!/[\p{L}]/u.test(text) || reported.has(node.start)) return;
			if (/^https?:\/\/[^\s]+$/.test(text.trim())) return; // URLs are technical data, including examples.
			// Sonner styling slots are CSS classes, not notification copy.
			if (file.endsWith("/toast.tsx") && /^(?:group-\[|text-label-)/.test(text))
				return;
			reported.add(node.start);
			context.report({
				node,
				message: `Move UI text to @solid-imager/i18n: ${JSON.stringify(text.trim())}`,
			});
		};
		/** @param {Node | null | undefined} node @param {Set<Node>} [seen] */
		const check = (node, seen = new Set()) => {
			if (!node || seen.has(node)) return;
			seen.add(node);
			if (node.type === "Literal" && typeof node.value === "string")
				report(node, node.value);
			else if (node.type === "TemplateLiteral") {
				report(
					node,
					node.quasis
						.map((part) => part.value.cooked ?? part.value.raw)
						.join("{}"),
				);
				for (const expression of node.expressions) check(expression, seen);
			} else if (node.type === "Identifier") {
				/** @type {ReturnType<typeof context.sourceCode.getScope> | null} */
				let scope = context.sourceCode.getScope(node);
				while (scope) {
					const variable = scope.set.get(node.name);
					if (variable) {
						for (const definition of variable.defs) {
							if (definition.node.type === "VariableDeclarator")
								check(definition.node.init, seen);
							else if (definition.node.type === "FunctionDeclaration")
								check(definition.node.body, seen);
						}
						break;
					}
					scope = scope.upper;
				}
			} else if (node.type === "ConditionalExpression") {
				check(node.consequent, seen);
				check(node.alternate, seen);
			} else if (node.type === "LogicalExpression") {
				if (node.operator !== "&&") check(node.left, seen);
				check(node.right, seen);
			} else if (node.type === "BinaryExpression" && node.operator === "+") {
				check(node.left, seen);
				check(node.right, seen);
			} else if (
				node.type === "ArrowFunctionExpression" ||
				node.type === "FunctionExpression"
			)
				check(node.body, seen);
			else if (
				node.type === "CallExpression" &&
				node.callee.type === "Identifier"
			)
				check(node.callee, seen);
			else if (node.type === "MemberExpression") {
				let owner = node.object;
				if (owner.type === "Identifier") {
					let scope =
						/** @type {ReturnType<typeof context.sourceCode.getScope> | null} */ (
							context.sourceCode.getScope(owner)
						);
					while (scope) {
						const variable = scope.set.get(owner.name);
						if (variable) {
							const definition = variable.defs.find(
								(entry) => entry.node.type === "VariableDeclarator",
							);
							if (
								definition?.node.type === "VariableDeclarator" &&
								definition.node.init
							)
								owner = definition.node.init;
							break;
						}
						scope = scope.upper;
					}
				}
				while (
					owner.type === "TSAsExpression" ||
					owner.type === "TSSatisfiesExpression" ||
					owner.type === "TSNonNullExpression"
				)
					owner = owner.expression;
				if (owner.type === "ObjectExpression") {
					const key =
						!node.computed || node.property.type === "Literal"
							? nameOf(node.property)
							: null;
					for (const property of owner.properties) {
						if (
							property.type === "Property" &&
							(key === null || nameOf(property.key) === key)
						)
							check(property.value, seen);
					}
				} else check(owner, seen);
			} else if (node.type === "ObjectExpression") {
				for (const property of node.properties) {
					if (
						property.type === "Property" &&
						(displayName.test(nameOf(property.key)) ||
							/^(?:loading|success)$/.test(nameOf(property.key)))
					)
						check(property.value, seen);
				}
			} else if (node.type === "ArrayExpression") {
				for (const element of node.elements) check(element, seen);
			} else if (node.type === "BlockStatement") {
				for (const statement of node.body) {
					if (statement.type === "ReturnStatement")
						check(statement.argument, seen);
					else if (statement.type === "IfStatement") {
						check(statement.consequent, seen);
						check(statement.alternate, seen);
					} else if (statement.type === "TryStatement") {
						check(statement.block, seen);
						check(statement.handler?.body, seen);
						check(statement.finalizer, seen);
					} else if (statement.type === "SwitchStatement") {
						for (const branch of statement.cases)
							for (const item of branch.consequent) check(item, seen);
					}
				}
			} else if (node.type === "ReturnStatement") check(node.argument, seen);
			else if (
				node.type === "TSAsExpression" ||
				node.type === "TSSatisfiesExpression" ||
				node.type === "TSNonNullExpression"
			)
				check(node.expression, seen);
		};
		return {
			JSXText(node) {
				report(node, node.value);
			},
			JSXExpressionContainer(node) {
				if (node.parent.type !== "JSXAttribute") check(node.expression);
			},
			JSXAttribute(node) {
				if (
					nameOf(node.name) === "options" &&
					node.parent.type === "JSXOpeningElement" &&
					/^(?:Select|Combobox)$/.test(nameOf(node.parent.name))
				) {
					const renderer = node.parent.attributes.find(
						/** @param {Node} attribute */ (attribute) =>
							attribute.type === "JSXAttribute" &&
							nameOf(attribute.name) === "itemComponent",
					);
					// Custom renderers localize enum codes themselves; direct raw-value rendering displays the options.
					if (
						!renderer ||
						/>\s*\{\s*\w+\.item\.rawValue\s*\}\s*</.test(
							context.sourceCode.getText(renderer),
						)
					)
						check(
							node.value?.type === "JSXExpressionContainer"
								? node.value.expression
								: node.value,
						);
					return;
				}
				if (
					/^option(?:Label|Description|Value|TextValue)$/.test(
						nameOf(node.name),
					) ||
					!displayName.test(nameOf(node.name))
				)
					return;
				check(
					node.value?.type === "JSXExpressionContainer"
						? node.value.expression
						: node.value,
				);
			},
			Property(node) {
				if (
					nameOf(node.key) === "name" &&
					node.value.type === "Literal" &&
					typeof node.value.value === "string" &&
					/^[A-Z]/.test(node.value.value) &&
					!/^[A-Z_]+$|Error$/.test(node.value.value)
				)
					check(node.value);
				for (
					let ancestor = /** @type {Node | null} */ (node.parent);
					ancestor;
					ancestor = ancestor.parent
				) {
					if (
						ancestor.type === "Property" &&
						/^(?:classes|classList|classNames|style|styles)$/.test(
							nameOf(ancestor.key),
						)
					)
						return;
					if (
						ancestor.type === "CallExpression" &&
						/^(?:cva|cn|clsx)$/.test(
							context.sourceCode.getText(ancestor.callee),
						)
					)
						return;
				}
				if (
					!node.computed &&
					displayName.test(nameOf(node.key)) &&
					node.value.type !== "FunctionExpression"
				)
					check(node.value);
			},
			AssignmentPattern(node) {
				if (
					node.right.type !== "ObjectExpression" &&
					displayName.test(nameOf(node.left))
				)
					check(node.right);
			},
			FunctionDeclaration(node) {
				if (
					node.id &&
					(displayName.test(node.id.name) ||
						/^validate[A-Z]/.test(node.id.name))
				)
					check(node.body);
			},
			VariableDeclarator(node) {
				if (
					node.init?.type !== "ObjectExpression" &&
					node.id.type === "Identifier" &&
					displayName.test(node.id.name)
				)
					check(node.init);
			},
			CallExpression(node) {
				const name = context.sourceCode.getText(node.callee);
				const shortName =
					node.callee.type === "MemberExpression"
						? nameOf(node.callee.property)
						: nameOf(node.callee);
				if (
					name.endsWith(".setAttribute") &&
					node.arguments[0]?.type === "Literal" &&
					typeof node.arguments[0].value === "string" &&
					displayName.test(node.arguments[0].value)
				)
					check(node.arguments[1]);
				if (shortName === "onError") check(node.arguments[0]);
				if (name === "createButton") check(node.arguments[0]);
				if (shortName === "failRead") check(node.arguments[1]);
				if (name === "toast.promise") check(node.arguments[1]);
				if (name === "requireField" || /\.(?:min|max|length)$/.test(name))
					check(node.arguments[1]);
				if (shortName === "setCcipStatus" || shortName === "setJobStatus")
					return; // Domain status codes are localized where displayed.
				if (/^set\w*(?:Error|Errors|Message|Msg|Status)$/.test(shortName)) {
					const argument = /^(?:setReadError|setRequestMessage)$/.test(
						shortName,
					)
						? 1
						: 0;
					check(node.arguments[argument]);
				}
				if (
					/^(?:toast(?:\.(?:success|error|warning|info|message|loading))?|alert|confirm)$/.test(
						name,
					)
				)
					check(node.arguments[0]);
			},
			AssignmentExpression(node) {
				if (
					node.left.type === "MemberExpression" &&
					!node.left.computed &&
					/^(?:textContent|innerText|title|ariaLabel|ariaDescription)$/.test(
						nameOf(node.left.property),
					)
				)
					check(node.right);
			},
			NewExpression(node) {
				if (
					node.callee.type === "Identifier" &&
					/^(?:Error|TypeError|RangeError|APIError)$/.test(node.callee.name)
				)
					check(node.arguments[0]);
			},
			Literal(node) {
				// Also catch non-JSX Japanese labels stored in option tables or callbacks.
				if (
					typeof node.value === "string" &&
					/[ぁ-んァ-ヶ一-龠]/.test(node.value) &&
					!(node.parent.type === "Property" && node.parent.key === node) &&
					node.parent.type !== "TSLiteralType"
				)
					report(node, node.value);
			},
			TemplateLiteral(node) {
				if (
					node.quasis.some((part) =>
						/[ぁ-んァ-ヶ一-龠]/.test(part.value.cooked ?? ""),
					)
				)
					check(node);
			},
		};
	},
};

export default {
	meta: { name: "ui-text" },
	rules: { "no-raw-text": noRawText },
};
