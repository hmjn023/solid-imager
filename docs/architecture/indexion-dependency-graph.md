# solid-imager source dependencies (indexion + AST verification)

Updated **2026-11-01**, dependency-boundary fixes based on `b22d4dd6`.

Start with the [package map](package-dependency-graph.md) and [dependency audit](dependency-audit-2026-11-01.md). The audit records the findings, evidence, scope, and extraction limitations.

Indexion 0.19.0 returned **1,947 dependency records**, but omitted imports, re-exports, and dynamic imports in this checkout. The diagrams below use AST verification to complete and classify the source references: **740 TypeScript/JavaScript files**, **3,766 reference occurrences**, and **3,673 unique source/target/kind edges**. The old snapshot contained 1,783 indexion records; the increase is not a code-growth comparison because the extraction method changed.

Scope: `apps/{cli,server,tauri,xtracter}/src` and `packages/{application,client,core,db,ui}/src`. Includes source tests and locally generated route trees; excludes CSS, build outputs, scripts, Rust, dependencies' implementation, and reports. Package counts exclude test-source references.

Solid arrows show value imports/re-exports, dotted arrows explicit type-only references, and `dynamic` arrows literal `import()` / `require()`. Aliases and workspace exports resolve to actual source files. Each split block has at most 450 edges.

| Part | Scope | Edges | Blocks |
| --- | --- | ---: | ---: |
| [Apps and shared packages](indexion-dependency-graph-01-apps-and-core.md) | apps-and-core | 927 | 3 |
| [Server tests](indexion-dependency-graph-02-server-tests.md) | server-tests | 648 | 2 |
| [Server infrastructure and routes](indexion-dependency-graph-03-server-infrastructure-routes.md) | server-infrastructure-routes | 750 | 2 |
| [Server components and root modules](indexion-dependency-graph-04-server-application-components.md) | server-application-components | 265 | 1 |
| [Shared UI](indexion-dependency-graph-05-ui.md) | ui | 1083 | 3 |

The [un-split graph](indexion-dependency-graph-full.md) is available for tools with a higher `maxEdges` setting.

The browser-history behavior and snapshot contract are described in [search-history.md](search-history.md).
