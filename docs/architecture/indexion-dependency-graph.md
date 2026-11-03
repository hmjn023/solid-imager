# solid-imager source dependencies (indexion + AST verification)

Updated **2026-11-04** from `50d5336c` on [#837](https://github.com/hmjn023/solid-imager/pull/837).

Start with the [package map](package-dependency-graph.md) and [dependency audit](dependency-audit-2026-11-04.md). The [public API inventory](workspace-public-api.md) connects the former deep imports to the entry points used today.

Indexion 0.19.0 returned **1,949 dependency records**, but omitted imports, re-exports, and dynamic imports in this checkout. The diagrams below use AST verification to complete and classify the source references: **811 TypeScript/JavaScript files**, **3,887 reference occurrences**, and **3,793 unique source/target/kind edges**. Compared with the pre-refactor commit `dcd8b6e2`, the number of source files grew from 771 to 811 while unique edges fell from 3,902 to 3,793.

The scan covers `apps/{cli,server,tauri,xtracter}/src` and `packages/{application,client,core,db,ui}/src`. It includes source tests and the two generated route trees. CSS and scripts can appear as targets when a source file imports them. The scan omits build outputs, Rust and external implementations. The package map omits test-source references.

Solid arrows show value imports/re-exports, dotted arrows explicit type-only references, and `dynamic` arrows literal `import()` / `require()`. Aliases and workspace exports resolve to actual source files. Each split block has at most 450 edges.

| Part | Scope | Edges | Blocks |
| --- | --- | ---: | ---: |
| [Apps and shared packages](indexion-dependency-graph-01-apps-and-core.md) | apps-and-core | 1009 | 3 |
| [Server tests](indexion-dependency-graph-02-server-tests.md) | server-tests | 599 | 2 |
| [Server infrastructure and routes](indexion-dependency-graph-03-server-infrastructure-routes.md) | server-infrastructure-routes | 738 | 2 |
| [Server components and root modules](indexion-dependency-graph-04-server-application-components.md) | server-application-components | 281 | 1 |
| [Shared UI](indexion-dependency-graph-05-ui.md) | ui | 1166 | 3 |

The [un-split graph](indexion-dependency-graph-full.md) is available for tools with a higher `maxEdges` setting.

The browser-history behavior and snapshot contract are described in [search-history.md](search-history.md).
