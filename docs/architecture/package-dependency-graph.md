# solid-imager package dependencies

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

  cli -->|1 import| client
  cli -->|1 import| core

  server -->|24 imports| application
  server -->|4 imports| client
  server -->|138 imports| core
  server -->|16 imports| db
  server -->|89 imports| ui

  tauri -->|2 imports| client
  tauri -->|11 imports| core
  tauri -->|45 imports| ui

  xtracter -->|1 import| client
  xtracter -->|1 import| core

  application -->|24 imports| core
  db -->|6 imports| core
  ui -->|99 imports| core

  classDef app fill:#e8f1ff,stroke:#4f76a8,color:#132238;
  classDef pkg fill:#eef8ee,stroke:#5b8a5a,color:#173117;
  class cli,server,tauri,xtracter app;
  class application,client,core,db,ui pkg;
```
