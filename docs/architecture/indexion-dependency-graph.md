# solid-imager source dependencies (indexion)

The complete indexion graph contains 1,705 edges, while the default Mermaid renderer allows 500 edges. Use the split diagrams below for VS Code preview.

| Part | Scope | Edges |
| --- | --- | ---: |
| [01 apps and core](indexion-dependency-graph-01-apps-and-core.md) | CLI, Tauri, xtracter, and shared core packages | 409 |
| [02 server tests](indexion-dependency-graph-02-server-tests.md) | `apps/server/src/tests` | 340 |
| [03 server infrastructure and routes](indexion-dependency-graph-03-server-infrastructure-routes.md) | `apps/server/src/infrastructure` and `routes` | 326 |
| [04 server application and components](indexion-dependency-graph-04-server-application-components.md) | server application, components, domain, and root modules | 219 |
| [05 UI](indexion-dependency-graph-05-ui.md) | `packages/ui/src` | 411 |

The un-split graph is preserved in [indexion-dependency-graph-full.md](indexion-dependency-graph-full.md) for tools that allow a higher `maxEdges` value.
