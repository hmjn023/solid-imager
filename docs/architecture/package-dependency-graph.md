# solid-imager package dependencies

The edge labels are cross-package import counts from the scoped indexion graph; package-local and external dependency edges are omitted.

```mermaid
flowchart LR
  %% Aggregated from indexion's source dependency graph.
  %% Scope: apps/{cli,server,tauri,xtracter}/src and packages/{application,client,core,db,ui}/src.
  %% Edge labels are the number of import edges detected by indexion.

  subgraph apps["Apps"]
    cli["apps/cli"]
    server["apps/server"]
    tauri["apps/tauri"]
    xtracter["apps/xtracter"]
  end

  subgraph packages["Shared packages"]
    application["packages/application"]
    client["packages/client"]
    core["packages/core"]
    db["packages/db"]
    ui["packages/ui"]
  end

  application -->|25 imports| core
  cli -->|1 import| client
  cli -->|2 imports| core
  db -->|8 imports| core
  server -->|25 imports| application
  server -->|4 imports| client
  server -->|141 imports| core
  server -->|16 imports| db
  server -->|49 imports| ui
  tauri -->|3 imports| client
  tauri -->|17 imports| core
  tauri -->|38 imports| ui
  ui -->|108 imports| core
  xtracter -->|1 import| client
  xtracter -->|1 import| core

  classDef app fill:#e8f1ff,stroke:#4f76a8,color:#132238;
  classDef pkg fill:#eef8ee,stroke:#5b8a5a,color:#173117;
  class cli,server,tauri,xtracter app;
  class application,client,core,db,ui pkg;
```
