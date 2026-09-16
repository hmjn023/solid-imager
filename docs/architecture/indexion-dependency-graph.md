# solid-imager source dependencies (indexion)

The complete indexion graph contains 1,803 edges. The split diagrams below contain at most 450 edges per Mermaid block for VS Code preview.

Generated from the current `apps/*/src` and `packages/*/src` dependencies. Build outputs and reports are excluded.

| Part | Scope | Edges |
| --- | --- | ---: |
| [01 apps and core](indexion-dependency-graph-01-apps-and-core.md) | CLI, Tauri, xtracter, and shared core packages | 447 |
| [02 server tests](indexion-dependency-graph-02-server-tests.md) | `apps/server/src/tests` | 347 |
| [03 server infrastructure and routes](indexion-dependency-graph-03-server-infrastructure-routes.md) | `apps/server/src/infrastructure` and `routes` | 411 |
| [04 server components and root modules](indexion-dependency-graph-04-server-application-components.md) | server components, hooks, and root modules | 130 |
| [05 UI](indexion-dependency-graph-05-ui.md) | `packages/ui/src` | 468 |

The un-split graph is preserved in [indexion-dependency-graph-full.md](indexion-dependency-graph-full.md) for tools that allow a higher `maxEdges` value.

The browser-history behavior and snapshot contract are described in [search-history.md](search-history.md).
