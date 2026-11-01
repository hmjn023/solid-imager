# solid-imager dependencies: Server infrastructure and routes

Generated 2026-11-01 from dependency-boundary fixes based on `b22d4dd6`. Indexion 0.19.0 output was checked and completed with a TypeScript/JavaScript AST scan. See the [method and findings](dependency-audit-2026-11-01.md).

Solid arrows: value imports/re-exports. Dotted arrows: explicit type-only references. `dynamic`: literal `import()` / `require()`. External modules use `external:`; workspace aliases are resolved to source files. Repeated `(source, target, kind)` edges are collapsed. These are source references, not bundler reachability results.

750 edges; at most 450 edges per Mermaid block.

## Part 1

```mermaid
flowchart LR
  N0["apps/server/src/config/database.ts"]
  N1["apps/server/src/domain/repositories/job-repository.ts"]
  N2["apps/server/src/infrastructure/ai/dghs-imgutils-loader.ts"]
  N3["apps/server/src/infrastructure/ai/embedding-gemma-worker.ts"]
  N4["apps/server/src/infrastructure/ai/inference-options.ts"]
  N5["apps/server/src/infrastructure/ai/postgres-ccip-vector-store.ts"]
  N6["apps/server/src/infrastructure/ai/postgres-embedding-store.ts"]
  N7["apps/server/src/infrastructure/ai/rust-ai-client.ts"]
  N8["apps/server/src/infrastructure/api-clients/ai-api.ts"]
  N9["apps/server/src/infrastructure/api-clients/characters-api.ts"]
  N10["apps/server/src/infrastructure/api-clients/downloads-api.ts"]
  N11["apps/server/src/infrastructure/api-clients/fetch-url-api.ts"]
  N12["apps/server/src/infrastructure/api-clients/ips-api.ts"]
  N13["apps/server/src/infrastructure/api-clients/media-api.ts"]
  N14["apps/server/src/infrastructure/api-clients/orpc-client.ts"]
  N15["apps/server/src/infrastructure/api-clients/projects-api.ts"]
  N16["apps/server/src/infrastructure/api-clients/queries/index.ts"]
  N17["apps/server/src/infrastructure/api-clients/search-api.ts"]
  N18["apps/server/src/infrastructure/api-clients/sources-api.ts"]
  N19["apps/server/src/infrastructure/api-clients/thumbnails.ts"]
  N20["apps/server/src/infrastructure/api/app-router.ts"]
  N21["apps/server/src/infrastructure/api/clients/preset-client.ts"]
  N22["apps/server/src/infrastructure/api/clients/search-history-client.ts"]
  N23["apps/server/src/infrastructure/api/job-artifact.ts"]
  N24["apps/server/src/infrastructure/api/routers/ai-router.ts"]
  N25["apps/server/src/infrastructure/api/routers/authors-router.ts"]
  N26["apps/server/src/infrastructure/api/routers/categories-router.ts"]
  N27["apps/server/src/infrastructure/api/routers/characters-router.ts"]
  N28["apps/server/src/infrastructure/api/routers/config-router.ts"]
  N29["apps/server/src/infrastructure/api/routers/directories-router.ts"]
  N30["apps/server/src/infrastructure/api/routers/downloads-router.ts"]
  N31["apps/server/src/infrastructure/api/routers/entity-media-counts.ts"]
  N32["apps/server/src/infrastructure/api/routers/imports-router.ts"]
  N33["apps/server/src/infrastructure/api/routers/ips-router.ts"]
  N34["apps/server/src/infrastructure/api/routers/jobs-router.ts"]
  N35["apps/server/src/infrastructure/api/routers/media-router.ts"]
  N36["apps/server/src/infrastructure/api/routers/presets-router.ts"]
  N37["apps/server/src/infrastructure/api/routers/projects-router.ts"]
  N38["apps/server/src/infrastructure/api/routers/search-snapshots-router.ts"]
  N39["apps/server/src/infrastructure/api/routers/sources-router.ts"]
  N40["apps/server/src/infrastructure/api/routers/tags-router.ts"]
  N41["apps/server/src/infrastructure/api/routers/thumbnails-router.ts"]
  N42["apps/server/src/infrastructure/api/routers/utils-router.ts"]
  N43["apps/server/src/infrastructure/bootstrap.ts"]
  N44["apps/server/src/infrastructure/db/__mocks__/index.ts"]
  N45["apps/server/src/infrastructure/db/connection.ts"]
  N46["apps/server/src/infrastructure/db/data-migration.ts"]
  N47["apps/server/src/infrastructure/db/errors.ts"]
  N48["apps/server/src/infrastructure/db/executor.ts"]
  N49["apps/server/src/infrastructure/db/index.ts"]
  N50["apps/server/src/infrastructure/db/pglite.ts"]
  N51["apps/server/src/infrastructure/db/postgres-driver.ts"]
  N52["apps/server/src/infrastructure/db/schema.ts"]
  N53["apps/server/src/infrastructure/db/transaction-manager.ts"]
  N54["apps/server/src/infrastructure/events/realtime-event-bus.ts"]
  N55["apps/server/src/infrastructure/file-system/node-file-system.ts"]
  N56["apps/server/src/infrastructure/jobs/ccip-jobs.ts"]
  N57["apps/server/src/infrastructure/jobs/download-jobs.ts"]
  N58["apps/server/src/infrastructure/jobs/download-rate-limiter.ts"]
  N59["apps/server/src/infrastructure/jobs/embedding-jobs.ts"]
  N60["apps/server/src/infrastructure/jobs/file-watcher-manager.ts"]
  N61["apps/server/src/infrastructure/jobs/file-watcher-service.ts"]
  N62["apps/server/src/infrastructure/jobs/job-worker.ts"]
  N63["apps/server/src/infrastructure/jobs/tag-extraction.ts"]
  N64["apps/server/src/infrastructure/jobs/tagging-jobs.ts"]
  N65["apps/server/src/infrastructure/jobs/thumbnails.ts"]
  N66["apps/server/src/infrastructure/logger.ts"]
  N67["apps/server/src/infrastructure/processing/bun-image.ts"]
  N68["apps/server/src/infrastructure/processing/image-processor.ts"]
  N69["apps/server/src/infrastructure/repositories/author-repository.ts"]
  N70["apps/server/src/infrastructure/repositories/category-repository.ts"]
  N71["apps/server/src/infrastructure/repositories/character-repository.ts"]
  N72["apps/server/src/infrastructure/repositories/collection-repository.ts"]
  N73["apps/server/src/infrastructure/repositories/ip-repository.ts"]
  N74["apps/server/src/infrastructure/repositories/job-repository.ts"]
  N75["apps/server/src/infrastructure/repositories/media-repository-utils.ts"]
  N76["apps/server/src/infrastructure/repositories/media-repository.ts"]
  N77["apps/server/src/infrastructure/repositories/preset-repository.ts"]
  N78["apps/server/src/infrastructure/repositories/project-repository.ts"]
  N79["apps/server/src/infrastructure/repositories/search-snapshot-repository.ts"]
  N80["apps/server/src/infrastructure/repositories/source-repository.ts"]
  N81["apps/server/src/infrastructure/repositories/tag-repository.ts"]
  N82["apps/server/src/infrastructure/repositories/user-repository.ts"]
  N83["apps/server/src/infrastructure/router/route-types.ts"]
  N84["apps/server/src/infrastructure/server-route-bootstrap.ts"]
  N85["apps/server/src/infrastructure/service-registry.ts"]
  N86["apps/server/src/infrastructure/services/ai-batch-targets.ts"]
  N87["apps/server/src/infrastructure/services/author-account-verification-service.ts"]
  N88["apps/server/src/infrastructure/services/author-service.ts"]
  N89["apps/server/src/infrastructure/services/backup-service.ts"]
  N90["apps/server/src/infrastructure/services/bulk-operation-service.ts"]
  N91["apps/server/src/infrastructure/services/category-service.ts"]
  N92["apps/server/src/infrastructure/services/ccip-vector-service.ts"]
  N93["apps/server/src/infrastructure/services/character-clustering-job-service.ts"]
  N94["apps/server/src/infrastructure/services/character-clustering-results-store.ts"]
  N95["apps/server/src/infrastructure/services/character-service.ts"]
  N96["apps/server/src/infrastructure/services/directory-service.ts"]
  N97["apps/server/src/infrastructure/services/directory-sync-service.ts"]
  N98["apps/server/src/infrastructure/services/embedding-search-service.ts"]
  N99["apps/server/src/infrastructure/services/ip-service.ts"]
  N100["apps/server/src/infrastructure/services/job-dispatch-service.ts"]
  N101["apps/server/src/infrastructure/services/job-transfer-storage.ts"]
  N102["apps/server/src/infrastructure/services/maintenance-service.ts"]
  N103["apps/server/src/infrastructure/services/media-processing-service.ts"]
  N104["apps/server/src/infrastructure/services/media-service.ts"]
  N105["apps/server/src/infrastructure/services/media-source-service.ts"]
  N106["apps/server/src/infrastructure/services/preset-service.ts"]
  N107["apps/server/src/infrastructure/services/project-service.ts"]
  N108["apps/server/src/infrastructure/services/search-snapshot-service.ts"]
  N109["apps/server/src/infrastructure/services/server-config-service.ts"]
  N110["apps/server/src/infrastructure/services/tag-service.ts"]
  N111["apps/server/src/infrastructure/services/tagging-service.ts"]
  N112["apps/server/src/infrastructure/services/thumbnail-service.ts"]
  N113["apps/server/src/infrastructure/storage/server-media-storage.ts"]
  N114["apps/server/src/infrastructure/utils/ffmpeg.ts"]
  N115["apps/server/src/infrastructure/utils/stream-utils.ts"]
  N116["external:@electric-sql/pglite"]
  N117["external:@electric-sql/pglite-pgvector"]
  N118["external:@orpc/server"]
  N119["external:@orpc/solid-query"]
  N120["external:@tanstack/solid-query"]
  N121["external:@tanstack/solid-start"]
  N122["external:@tanstack/solid-start/server"]
  N123["external:bun"]
  N124["external:chokidar"]
  N125["external:dghs-imgutils-rs"]
  N126["external:drizzle-orm"]
  N127["external:drizzle-orm/bun-sql"]
  N128["external:drizzle-orm/node-postgres"]
  N129["external:drizzle-orm/pglite"]
  N130["external:node:events"]
  N131["external:node:fs"]
  N132["external:node:fs/promises"]
  N133["external:node:module"]
  N134["external:node:os"]
  N135["external:node:path"]
  N136["external:node:url"]
  N137["external:node:worker_threads"]
  N138["external:pg"]
  N139["external:pino"]
  N140["external:sharp"]
  N141["external:uuid"]
  N142["external:vitest"]
  N143["external:youtube-dl-exec"]
  N144["external:zod"]
  N145["external:zod/compile"]
  N146["packages/application/src/index.ts"]
  N147["packages/application/src/ports/ccip-vector-store.ts"]
  N148["packages/application/src/ports/embedding-store.ts"]
  N149["packages/application/src/ports/media-service.ts"]
  N150["packages/application/src/services/ccip-vector-service.ts"]
  N151["packages/client/src/index.ts"]
  N152["packages/core/src/domain/config/config-schema.ts"]
  N153["packages/core/src/domain/contract/ai.contract.ts"]
  N154["packages/core/src/domain/contract/authors.contract.ts"]
  N155["packages/core/src/domain/contract/categories.contract.ts"]
  N156["packages/core/src/domain/contract/characters.contract.ts"]
  N157["packages/core/src/domain/contract/config.contract.ts"]
  N158["packages/core/src/domain/contract/directories.contract.ts"]
  N159["packages/core/src/domain/contract/downloads.contract.ts"]
  N160["packages/core/src/domain/contract/imports.contract.ts"]
  N161["packages/core/src/domain/contract/index.ts"]
  N162["packages/core/src/domain/contract/ips.contract.ts"]
  N163["packages/core/src/domain/contract/jobs.contract.ts"]
  N164["packages/core/src/domain/contract/media.contract.ts"]
  N165["packages/core/src/domain/contract/presets-client.ts"]
  N166["packages/core/src/domain/contract/presets.contract.ts"]
  N167["packages/core/src/domain/contract/projects.contract.ts"]
  N168["packages/core/src/domain/contract/search-snapshots-client.ts"]
  N169["packages/core/src/domain/contract/search-snapshots.contract.ts"]
  N170["packages/core/src/domain/contract/sources.contract.ts"]
  N171["packages/core/src/domain/contract/tags.contract.ts"]
  N172["packages/core/src/domain/contract/thumbnails.contract.ts"]
  N173["packages/core/src/domain/contract/utils.contract.ts"]
  N174["packages/core/src/domain/errors/index.ts"]
  N175["packages/core/src/domain/interfaces/ai-client.ts"]
  N176["packages/core/src/domain/interfaces/transaction-manager.ts"]
  N177["packages/core/src/domain/jobs/schemas.ts"]
  N178["packages/core/src/domain/media/schemas.ts"]
  N179["packages/core/src/domain/media/utils/filename-utils.ts"]
  N180["packages/core/src/domain/media/utils/media-type-utils.ts"]
  N181["packages/core/src/domain/media/utils/metadata-utils.ts"]
  N182["packages/core/src/domain/repositories/author-repository.ts"]
  N183["packages/core/src/domain/repositories/category-repository.ts"]
  N184["packages/core/src/domain/repositories/character-repository.ts"]
  N185["packages/core/src/domain/repositories/collection-repository.ts"]
  N186["packages/core/src/domain/repositories/ip-repository.ts"]
  N187["packages/core/src/domain/repositories/job-repository.ts"]
  N188["packages/core/src/domain/repositories/media-repository.ts"]
  N189["packages/core/src/domain/repositories/preset-repository.ts"]
  N190["packages/core/src/domain/repositories/project-repository.ts"]
  N191["packages/core/src/domain/repositories/search-snapshot-repository.ts"]
  N192["packages/core/src/domain/repositories/source-repository.ts"]
  N193["packages/core/src/domain/repositories/tag-repository.ts"]
  N194["packages/core/src/domain/repositories/user-repository.ts"]
  N195["packages/core/src/domain/search/embedding.ts"]
  N196["packages/core/src/domain/search/history.ts"]
  N197["packages/core/src/domain/services/image-processor.ts"]
  N198["packages/core/src/domain/sources/events.ts"]
  N199["packages/core/src/domain/sources/schemas.ts"]
  N200["packages/core/src/domain/tagging/schemas.ts"]
  N201["packages/core/src/domain/thumbnails/schemas.ts"]
  N202["packages/core/src/index.ts"]
  N203["packages/core/src/utils/async-pool.ts"]
  N204["packages/core/src/utils/index.ts"]
  N205["packages/core/src/utils/type-guards.ts"]
  N206["packages/db/src/repositories/author-repository.ts"]
  N207["packages/db/src/repositories/category-repository.ts"]
  N208["packages/db/src/repositories/character-repository.ts"]
  N209["packages/db/src/repositories/collection-repository.ts"]
  N210["packages/db/src/repositories/ip-repository.ts"]
  N211["packages/db/src/repositories/job-repository.ts"]
  N212["packages/db/src/repositories/media-repository-utils.ts"]
  N213["packages/db/src/repositories/media-repository.ts"]
  N214["packages/db/src/repositories/preset-repository.ts"]
  N215["packages/db/src/repositories/project-repository.ts"]
  N216["packages/db/src/repositories/search-snapshot-repository.ts"]
  N217["packages/db/src/repositories/source-repository.ts"]
  N218["packages/db/src/repositories/tag-repository.ts"]
  N219["packages/db/src/repositories/user-repository.ts"]
  N220["packages/db/src/schema.ts"]
  N221["packages/db/src/types.ts"]
  N222["packages/ui/src/query-options/index.ts"]
  N2 -. type .-> N125
  N2 --> N131
  N2 --> N133
  N2 --> N135
  N2 --> N136
  N3 --> N2
  N3 --> N66
  N3 -. type .-> N125
  N3 --> N137
  N3 --> N144
  N3 --> N195
  N4 -. type .-> N125
  N4 -. type .-> N152
  N5 --> N126
  N5 --> N144
  N5 -. type .-> N147
  N5 -. type .-> N149
  N5 --> N220
  N5 -. type .-> N221
  N6 --> N126
  N6 --> N144
  N6 -. type .-> N148
  N6 --> N195
  N6 --> N220
  N6 -. type .-> N221
  N7 --> N2
  N7 --> N3
  N7 --> N4
  N7 -. type .-> N125
  N7 --> N134
  N7 --> N135
  N7 --> N151
  N7 -. type .-> N152
  N7 -. type .-> N161
  N7 -. type .-> N175
  N7 --> N195
  N7 --> N200
  N7 --> N203
  N8 --> N14
  N8 -. type .-> N144
  N8 -. type .-> N200
  N9 --> N14
  N10 --> N14
  N10 -. type .-> N178
  N11 --> N14
  N12 --> N14
  N13 --> N14
  N13 --> N17
  N14 --> N20
  N14 --> N118
  N14 --> N121
  N14 --> N122
  N14 --> N151
  N14 -. type .-> N161
  N15 --> N14
  N16 --> N14
  N16 --> N119
  N16 -. type .-> N177
  N16 --> N222
  N17 --> N14
  N17 -. type .-> N178
  N17 -. type .-> N195
  N18 --> N14
  N18 -. type .-> N144
  N18 --> N151
  N18 -. type .-> N199
  N19 --> N14
  N20 --> N24
  N20 --> N25
  N20 --> N26
  N20 --> N27
  N20 --> N28
  N20 --> N29
  N20 --> N30
  N20 --> N32
  N20 --> N33
  N20 --> N34
  N20 --> N35
  N20 --> N36
  N20 --> N37
  N20 --> N38
  N20 --> N39
  N20 --> N40
  N20 --> N41
  N20 --> N42
  N20 --> N118
  N20 --> N145
  N20 --> N161
  N21 --> N14
  N21 -. type .-> N165
  N22 --> N14
  N22 -. type .-> N168
  N23 --> N74
  N23 --> N101
  N23 --> N115
  N23 --> N131
  N23 --> N132
  N23 -. type .-> N187
  N24 --> N2
  N24 --> N3
  N24 --> N4
  N24 --> N49
  N24 --> N52
  N24 --> N59
  N24 --> N66
  N24 --> N85
  N24 --> N86
  N24 --> N92
  N24 --> N111
  N24 --> N118
  N24 -. type .-> N125
  N24 --> N126
  N24 --> N132
  N24 --> N134
  N24 --> N135
  N24 --> N140
  N24 --> N151
  N24 --> N153
  N24 -. type .-> N161
  N24 --> N200
  N25 --> N87
  N25 --> N88
  N25 --> N118
  N25 --> N154
  N25 --> N174
  N26 --> N91
  N26 --> N118
  N26 --> N155
  N27 --> N31
  N27 --> N85
  N27 --> N93
  N27 --> N94
  N27 --> N95
  N27 --> N118
  N27 --> N156
  N28 --> N85
  N28 --> N118
  N28 --> N157
  N29 --> N96
  N29 --> N118
  N29 --> N158
  N30 --> N57
  N30 --> N118
  N30 --> N159
  N31 --> N49
  N31 --> N52
  N31 --> N126
  N32 --> N49
  N32 --> N52
  N32 --> N54
  N32 --> N57
  N32 -->|dynamic| N89
  N32 -. type .-> N89
  N32 --> N118
  N32 --> N126
  N32 -. type .-> N144
  N32 --> N160
  N32 -. type .-> N178
  N32 -. type .-> N198
  N33 --> N31
  N33 --> N99
  N33 --> N118
  N33 --> N162
  N34 --> N23
  N34 --> N49
  N34 --> N52
  N34 --> N54
  N34 --> N74
  N34 --> N76
  N34 --> N118
  N34 --> N126
  N34 --> N144
  N34 --> N163
  N34 --> N177
  N34 -. type .-> N187
  N34 -. type .-> N198
  N35 --> N66
  N35 --> N90
  N35 --> N92
  N35 --> N98
  N35 --> N104
  N35 --> N118
  N35 --> N164
  N35 --> N174
  N35 --> N203
  N36 --> N106
  N36 --> N118
  N36 --> N166
  N37 --> N31
  N37 --> N107
  N37 --> N118
  N37 --> N167
  N38 --> N108
  N38 --> N118
  N38 --> N169
  N38 -. type .-> N196
  N38 --> N196
  N39 --> N34
  N39 --> N49
  N39 --> N52
  N39 --> N54
  N39 -->|dynamic| N61
  N39 --> N66
  N39 --> N74
  N39 --> N85
  N39 --> N97
  N39 --> N101
  N39 --> N105
  N39 --> N118
  N39 --> N126
  N39 -->|dynamic| N132
  N39 --> N170
  N39 -. type .-> N192
  N39 -. type .-> N198
  N39 --> N199
  N39 --> N203
  N40 --> N110
  N40 --> N118
  N40 --> N171
  N41 --> N112
  N41 --> N118
  N41 --> N172
  N42 --> N118
  N42 --> N173
  N43 --> N7
  N43 --> N53
  N43 --> N54
  N43 --> N55
  N43 --> N58
  N43 --> N62
  N43 --> N65
  N43 --> N66
  N43 --> N68
  N43 --> N69
  N43 --> N71
  N43 --> N73
  N43 --> N74
  N43 --> N76
  N43 --> N78
  N43 --> N80
  N43 --> N81
  N43 --> N85
  N43 --> N92
  N43 --> N95
  N43 --> N100
  N43 --> N102
  N43 --> N103
  N43 --> N109
  N43 --> N113
  N44 -. type .-> N52
  N44 --> N141
  N44 --> N142
  N45 -. type .-> N0
  N45 --> N50
  N45 --> N51
  N45 --> N116
  N45 --> N123
  N45 --> N138
  N46 --> N47
  N46 --> N49
  N46 --> N52
  N46 --> N126
  N48 --> N49
  N48 -. type .-> N221
  N49 --> N50
  N49 --> N51
  N49 --> N52
  N49 --> N66
  N49 -. type .-> N116
  N49 --> N123
  N49 --> N127
  N49 --> N128
  N49 --> N129
  N49 --> N135
  N49 --> N138
  N50 --> N116
  N50 --> N117
  N52 --> N220
  N53 --> N49
  N53 -. type .-> N176
  N54 --> N130
  N54 --> N198
  N55 --> N132
  N55 -. type .-> N202
  N56 --> N49
  N56 --> N52
  N56 --> N54
  N56 --> N66
  N56 --> N85
  N56 --> N92
  N56 --> N126
  N56 --> N144
  N56 -. type .-> N147
  N56 --> N150
  N56 --> N200
  N56 --> N204
  N57 --> N49
  N57 --> N52
  N57 --> N54
  N57 --> N58
  N57 --> N66
  N57 --> N76
  N57 --> N80
  N57 -->|dynamic| N103
  N57 --> N113
  N57 --> N114
  N57 -->|dynamic| N131
  N57 --> N132
  N57 --> N134
  N57 -->|dynamic| N135
  N57 --> N135
  N57 -->|dynamic| N136
  N57 --> N143
  N57 --> N144
  N57 -. type .-> N178
  N57 --> N178
  N57 --> N179
  N57 --> N180
  N57 --> N203
  N57 --> N205
  N58 -. type .-> N152
  N59 --> N49
  N59 --> N52
  N59 --> N54
  N59 --> N66
  N59 --> N85
  N59 --> N98
  N59 --> N126
  N59 --> N144
  N59 --> N195
  N59 --> N200
  N60 --> N54
  N60 --> N66
  N60 --> N124
  N60 --> N135
  N61 --> N54
  N61 --> N60
  N61 --> N65
  N61 --> N66
  N61 --> N76
  N61 --> N80
  N61 --> N85
  N61 --> N92
  N61 --> N97
  N61 --> N103
  N61 --> N113
  N61 --> N135
  N62 -. type .-> N1
  N62 -. type .-> N52
  N62 --> N54
  N62 --> N66
  N62 --> N101
  N62 -. type .-> N152
  N63 --> N68
  N63 --> N81
  N64 --> N49
  N64 --> N52
  N64 --> N54
  N64 --> N66
  N64 --> N85
  N64 --> N111
  N64 --> N126
  N64 --> N144
  N64 --> N200
  N65 -. type .-> N52
  N65 --> N54
  N65 --> N68
  N65 --> N76
  N65 --> N80
  N65 --> N85
  N65 --> N132
  N65 --> N135
  N65 --> N200
  N65 --> N201
  N66 --> N139
  N67 --> N140
  N68 --> N66
  N68 --> N67
  N68 --> N85
  N68 --> N114
  N68 -->|dynamic| N132
  N68 -->|dynamic| N134
  N68 -->|dynamic| N135
  N68 --> N140
  N68 -. type .-> N178
  N68 --> N181
  N68 -. type .-> N197
  N68 --> N205
  N69 --> N48
  N69 -. type .-> N182
  N69 --> N206
  N70 --> N48
  N70 -. type .-> N183
  N70 --> N207
  N71 --> N48
  N71 -. type .-> N184
  N71 --> N208
  N72 --> N48
  N72 -. type .-> N185
  N72 --> N209
  N73 --> N48
  N73 -. type .-> N186
  N73 --> N210
  N74 --> N48
  N74 -. type .-> N187
  N74 --> N211
  N75 --> N48
  N75 --> N212
  N76 --> N48
  N76 --> N66
  N76 --> N69
  N76 --> N81
  N76 -. type .-> N188
  N76 --> N212
  N76 --> N213
  N77 --> N48
  N77 -. type .-> N189
  N77 --> N214
  N78 --> N48
  N78 -. type .-> N190
  N78 --> N215
  N79 --> N48
  N79 -. type .-> N191
  N79 --> N216
  N80 --> N48
  N80 -. type .-> N192
  N80 --> N217
  N81 --> N48
  N81 -. type .-> N193
  N81 --> N218
  N82 --> N48
  N82 -. type .-> N194
  N82 --> N219
  N83 -. type .-> N120
  N84 --> N43
  N85 -. type .-> N62
  N85 -. type .-> N146
  N85 -. type .-> N175
  N85 -. type .-> N182
  N85 -. type .-> N184
  N85 -. type .-> N186
  N85 -. type .-> N187
  N85 -. type .-> N188
  N85 -. type .-> N190
  N85 -. type .-> N192
  N85 -. type .-> N193
  N85 -. type .-> N197
  N85 -. type .-> N202
  N86 --> N52
  N86 --> N126
```

## Part 2

```mermaid
flowchart LR
  N0["apps/server/scripts/character-clustering/extract.ts"]
  N1["apps/server/scripts/character-clustering/fit.ts"]
  N2["apps/server/src/app.css"]
  N3["apps/server/src/components/home-route.tsx"]
  N4["apps/server/src/components/layout/layout.tsx"]
  N5["apps/server/src/components/media/bulk-action-dialog.tsx"]
  N6["apps/server/src/components/media/media-context.ts"]
  N7["apps/server/src/components/media/media-grid-item.tsx"]
  N8["apps/server/src/components/media/move-copy-media-dialog.tsx"]
  N9["apps/server/src/components/media/thumbnail-image.tsx"]
  N10["apps/server/src/components/not-found.tsx"]
  N11["apps/server/src/components/pages/about-page.tsx"]
  N12["apps/server/src/components/pages/config-page.tsx"]
  N13["apps/server/src/components/pages/jobs-page.tsx"]
  N14["apps/server/src/components/pages/manager-page.tsx"]
  N15["apps/server/src/components/pages/media-detail-page.tsx"]
  N16["apps/server/src/components/pages/search-content.tsx"]
  N17["apps/server/src/components/scalar-api-reference.tsx"]
  N18["apps/server/src/components/upload-media-modal.tsx"]
  N19["apps/server/src/domain/repositories/job-repository.ts"]
  N20["apps/server/src/hooks/use-media-source-events.ts"]
  N21["apps/server/src/infrastructure/ai/postgres-ccip-vector-store.ts"]
  N22["apps/server/src/infrastructure/ai/postgres-embedding-store.ts"]
  N23["apps/server/src/infrastructure/api-clients/downloads-api.ts"]
  N24["apps/server/src/infrastructure/api-clients/media-api.ts"]
  N25["apps/server/src/infrastructure/api-clients/queries/index.ts"]
  N26["apps/server/src/infrastructure/api-clients/search-api.ts"]
  N27["apps/server/src/infrastructure/api/app-router.ts"]
  N28["apps/server/src/infrastructure/api/clients/preset-client.ts"]
  N29["apps/server/src/infrastructure/api/clients/search-history-client.ts"]
  N30["apps/server/src/infrastructure/api/job-artifact.ts"]
  N31["apps/server/src/infrastructure/api/rpc-response-headers.ts"]
  N32["apps/server/src/infrastructure/db/index.ts"]
  N33["apps/server/src/infrastructure/db/schema.ts"]
  N34["apps/server/src/infrastructure/db/transaction-manager.ts"]
  N35["apps/server/src/infrastructure/events/realtime-event-bus.ts"]
  N36["apps/server/src/infrastructure/jobs/ccip-jobs.ts"]
  N37["apps/server/src/infrastructure/jobs/download-jobs.ts"]
  N38["apps/server/src/infrastructure/jobs/embedding-jobs.ts"]
  N39["apps/server/src/infrastructure/jobs/file-watcher-service.ts"]
  N40["apps/server/src/infrastructure/jobs/tagging-jobs.ts"]
  N41["apps/server/src/infrastructure/jobs/thumbnails.ts"]
  N42["apps/server/src/infrastructure/logger.ts"]
  N43["apps/server/src/infrastructure/processing/bun-image.ts"]
  N44["apps/server/src/infrastructure/repositories/author-repository.ts"]
  N45["apps/server/src/infrastructure/repositories/category-repository.ts"]
  N46["apps/server/src/infrastructure/repositories/collection-repository.ts"]
  N47["apps/server/src/infrastructure/repositories/ip-repository.ts"]
  N48["apps/server/src/infrastructure/repositories/media-repository.ts"]
  N49["apps/server/src/infrastructure/repositories/preset-repository.ts"]
  N50["apps/server/src/infrastructure/repositories/project-repository.ts"]
  N51["apps/server/src/infrastructure/repositories/search-snapshot-repository.ts"]
  N52["apps/server/src/infrastructure/repositories/source-repository.ts"]
  N53["apps/server/src/infrastructure/repositories/tag-repository.ts"]
  N54["apps/server/src/infrastructure/repositories/user-repository.ts"]
  N55["apps/server/src/infrastructure/router/route-types.ts"]
  N56["apps/server/src/infrastructure/server-route-bootstrap.ts"]
  N57["apps/server/src/infrastructure/service-registry.ts"]
  N58["apps/server/src/infrastructure/services/ai-batch-targets.ts"]
  N59["apps/server/src/infrastructure/services/author-account-verification-service.ts"]
  N60["apps/server/src/infrastructure/services/author-service.ts"]
  N61["apps/server/src/infrastructure/services/backup-service.ts"]
  N62["apps/server/src/infrastructure/services/bulk-operation-service.ts"]
  N63["apps/server/src/infrastructure/services/category-service.ts"]
  N64["apps/server/src/infrastructure/services/ccip-vector-service.ts"]
  N65["apps/server/src/infrastructure/services/character-clustering-job-service.ts"]
  N66["apps/server/src/infrastructure/services/character-clustering-results-store.ts"]
  N67["apps/server/src/infrastructure/services/character-service.ts"]
  N68["apps/server/src/infrastructure/services/collection-service.ts"]
  N69["apps/server/src/infrastructure/services/directory-service.ts"]
  N70["apps/server/src/infrastructure/services/directory-sync-service.ts"]
  N71["apps/server/src/infrastructure/services/embedding-search-service.ts"]
  N72["apps/server/src/infrastructure/services/ip-service.ts"]
  N73["apps/server/src/infrastructure/services/job-dispatch-service.ts"]
  N74["apps/server/src/infrastructure/services/job-transfer-storage.ts"]
  N75["apps/server/src/infrastructure/services/maintenance-service.ts"]
  N76["apps/server/src/infrastructure/services/media-processing-service.ts"]
  N77["apps/server/src/infrastructure/services/media-service.ts"]
  N78["apps/server/src/infrastructure/services/media-source-service.ts"]
  N79["apps/server/src/infrastructure/services/preset-service.ts"]
  N80["apps/server/src/infrastructure/services/project-service.ts"]
  N81["apps/server/src/infrastructure/services/search-service.ts"]
  N82["apps/server/src/infrastructure/services/search-snapshot-service.ts"]
  N83["apps/server/src/infrastructure/services/server-config-service.ts"]
  N84["apps/server/src/infrastructure/services/source-transfer-job-service.ts"]
  N85["apps/server/src/infrastructure/services/tag-service.ts"]
  N86["apps/server/src/infrastructure/services/tagging-service.ts"]
  N87["apps/server/src/infrastructure/services/thumbnail-service.ts"]
  N88["apps/server/src/infrastructure/services/user-service.ts"]
  N89["apps/server/src/infrastructure/storage/factory.ts"]
  N90["apps/server/src/infrastructure/storage/local.ts"]
  N91["apps/server/src/infrastructure/storage/schema.ts"]
  N92["apps/server/src/infrastructure/storage/server-media-storage.ts"]
  N93["apps/server/src/infrastructure/utils/ffmpeg.ts"]
  N94["apps/server/src/infrastructure/utils/stream-utils.ts"]
  N95["apps/server/src/presentation/store/search-store.ts"]
  N96["apps/server/src/routes/$.tsx"]
  N97["apps/server/src/routes/__root.tsx"]
  N98["apps/server/src/routes/about.tsx"]
  N99["apps/server/src/routes/api/health.ts"]
  N100["apps/server/src/routes/api/jobs.$jobId.artifact.ts"]
  N101["apps/server/src/routes/api/rpc.$.ts"]
  N102["apps/server/src/routes/api/sources.$mediaSourceId.$mediaId.ts"]
  N103["apps/server/src/routes/api/sources.$mediaSourceId.thumbnail.$mediaId.ts"]
  N104["apps/server/src/routes/config.tsx"]
  N105["apps/server/src/routes/design-lab.tsx"]
  N106["apps/server/src/routes/docs/scalar/index.tsx"]
  N107["apps/server/src/routes/docs/swagger/index.tsx"]
  N108["apps/server/src/routes/index.tsx"]
  N109["apps/server/src/routes/jobs.tsx"]
  N110["apps/server/src/routes/manager.tsx"]
  N111["apps/server/src/routes/search.tsx"]
  N112["apps/server/src/routes/sources/$mediaSourceId/$mediaId/index.tsx"]
  N113["apps/server/src/routes/sources/$mediaSourceId/components/source-media-controller.tsx"]
  N114["apps/server/src/routes/sources/$mediaSourceId/components/source-media-page.tsx"]
  N115["apps/server/src/routes/sources/$mediaSourceId/index.tsx"]
  N116["apps/server/src/routes/sources/index.tsx"]
  N117["external:@orpc/server/fetch"]
  N118["external:@orpc/server/plugins"]
  N119["external:@tanstack/solid-query"]
  N120["external:@tanstack/solid-router"]
  N121["external:archiver"]
  N122["external:drizzle-orm"]
  N123["external:drizzle-orm/pg-core"]
  N124["external:ffmpeg-static"]
  N125["external:fluent-ffmpeg"]
  N126["external:node:child_process"]
  N127["external:node:crypto"]
  N128["external:node:fs"]
  N129["external:node:fs/promises"]
  N130["external:node:path"]
  N131["external:node:readline"]
  N132["external:node:stream"]
  N133["external:node:stream/promises"]
  N134["external:node:util"]
  N135["external:solid-js"]
  N136["external:solid-js/web"]
  N137["external:zod"]
  N138["packages/application/src/index.ts"]
  N139["packages/application/src/ports/character-clustering-results-store.ts"]
  N140["packages/application/src/ports/media-service.ts"]
  N141["packages/application/src/services/author-account-verification-service.ts"]
  N142["packages/application/src/services/author-service.ts"]
  N143["packages/application/src/services/category-service.ts"]
  N144["packages/application/src/services/ccip-vector-service.ts"]
  N145["packages/application/src/services/character-clustering-review-service.ts"]
  N146["packages/application/src/services/character-service.ts"]
  N147["packages/application/src/services/collection-service.ts"]
  N148["packages/application/src/services/embedding-search-service.ts"]
  N149["packages/application/src/services/ip-service.ts"]
  N150["packages/application/src/services/media-processing-service.ts"]
  N151["packages/application/src/services/media-query-service.ts"]
  N152["packages/application/src/services/media-service.ts"]
  N153["packages/application/src/services/media-transfer-service.ts"]
  N154["packages/application/src/services/media-upload-service.ts"]
  N155["packages/application/src/services/preset-service.ts"]
  N156["packages/application/src/services/project-service.ts"]
  N157["packages/application/src/services/search-service.ts"]
  N158["packages/application/src/services/search-snapshot-service.ts"]
  N159["packages/application/src/services/tag-service.ts"]
  N160["packages/application/src/services/tagging-service.ts"]
  N161["packages/application/src/services/thumbnail-service.ts"]
  N162["packages/application/src/services/user-service.ts"]
  N163["packages/core/src/domain/authors/schemas.ts"]
  N164["packages/core/src/domain/characters/schemas.ts"]
  N165["packages/core/src/domain/config/config-schema.ts"]
  N166["packages/core/src/domain/errors/index.ts"]
  N167["packages/core/src/domain/interfaces/transaction-manager.ts"]
  N168["packages/core/src/domain/jobs/schemas.ts"]
  N169["packages/core/src/domain/media/schemas.ts"]
  N170["packages/core/src/domain/media/upload-schemas.ts"]
  N171["packages/core/src/domain/media/utils/media-type-utils.ts"]
  N172["packages/core/src/domain/repositories/job-repository.ts"]
  N173["packages/core/src/domain/repositories/media-repository.ts"]
  N174["packages/core/src/domain/repositories/preset-repository.ts"]
  N175["packages/core/src/domain/repositories/search-snapshot-repository.ts"]
  N176["packages/core/src/domain/repositories/source-repository.ts"]
  N177["packages/core/src/domain/sources/schemas.ts"]
  N178["packages/core/src/domain/thumbnails/schemas.ts"]
  N179["packages/core/src/index.ts"]
  N180["packages/core/src/utils/async-pool.ts"]
  N181["packages/core/src/utils/get-error-message.ts"]
  N182["packages/core/src/utils/type-guards.ts"]
  N183["packages/db/src/types.ts"]
  N184["packages/ui/src/button.tsx"]
  N185["packages/ui/src/hooks/use-media-collection-selection.ts"]
  N186["packages/ui/src/preset-client.ts"]
  N187["packages/ui/src/query-options/index.ts"]
  N188["packages/ui/src/router-status.tsx"]
  N189["packages/ui/src/screens/design-concept-screen.tsx"]
  N190["packages/ui/src/screens/source-media-screen.types.ts"]
  N191["packages/ui/src/search-history-client.ts"]
  N192["packages/ui/src/search-history-route.ts"]
  N193["packages/ui/src/shortcuts/index.ts"]
  N194["packages/ui/src/source-media-page.tsx"]
  N195["packages/ui/src/stores/search-store.ts"]
  N196["packages/ui/src/toast.tsx"]
  N58 --> N144
  N58 -. type .-> N183
  N59 --> N60
  N59 --> N141
  N60 --> N34
  N60 --> N44
  N60 --> N142
  N61 --> N32
  N61 --> N33
  N61 --> N42
  N61 -->|dynamic| N57
  N61 --> N74
  N61 --> N89
  N61 --> N94
  N61 -->|dynamic| N121
  N61 -. type .-> N121
  N61 -. type .-> N122
  N61 --> N122
  N61 -. type .-> N123
  N61 -->|dynamic| N126
  N61 -->|dynamic| N128
  N61 --> N128
  N61 --> N129
  N61 -->|dynamic| N130
  N61 --> N130
  N61 -->|dynamic| N131
  N61 -->|dynamic| N132
  N61 -. type .-> N132
  N61 --> N133
  N61 -. type .-> N163
  N61 --> N169
  N61 --> N177
  N61 --> N181
  N62 --> N41
  N62 --> N42
  N62 --> N57
  N62 -->|dynamic| N77
  N62 --> N169
  N62 -->|dynamic| N180
  N63 --> N45
  N63 --> N143
  N64 --> N21
  N64 --> N32
  N64 --> N57
  N64 --> N86
  N64 -. type .-> N140
  N64 --> N144
  N65 --> N0
  N65 --> N1
  N65 --> N66
  N65 --> N127
  N65 --> N129
  N65 --> N130
  N65 --> N164
  N65 -. type .-> N172
  N66 --> N42
  N66 --> N127
  N66 --> N129
  N66 --> N130
  N66 --> N137
  N66 -. type .-> N139
  N66 --> N145
  N66 --> N164
  N66 --> N166
  N67 --> N57
  N67 --> N146
  N67 -. type .-> N164
  N68 --> N46
  N68 --> N147
  N69 --> N78
  N69 --> N89
  N70 --> N35
  N70 --> N41
  N70 --> N42
  N70 --> N48
  N70 --> N52
  N70 --> N57
  N70 --> N64
  N70 --> N76
  N70 --> N129
  N70 --> N130
  N70 --> N177
  N71 --> N22
  N71 --> N32
  N71 --> N57
  N71 --> N148
  N72 --> N47
  N72 --> N149
  N73 --> N35
  N73 -->|dynamic| N36
  N73 -->|dynamic| N37
  N73 -->|dynamic| N38
  N73 --> N40
  N73 --> N42
  N73 --> N57
  N73 -->|dynamic| N65
  N73 -->|dynamic| N76
  N73 --> N84
  N73 -. type .-> N140
  N73 -. type .-> N172
  N74 --> N94
  N74 -. type .-> N128
  N74 --> N128
  N74 --> N129
  N74 --> N130
  N74 --> N133
  N74 -. type .-> N172
  N75 -. type .-> N19
  N75 -->|dynamic| N39
  N75 --> N41
  N75 --> N42
  N75 --> N129
  N75 --> N130
  N75 -. type .-> N173
  N75 -. type .-> N176
  N76 --> N57
  N76 --> N150
  N76 -. type .-> N167
  N76 -. type .-> N169
  N76 -. type .-> N172
  N77 --> N34
  N77 --> N35
  N77 --> N41
  N77 --> N42
  N77 --> N57
  N77 --> N73
  N77 -. type .-> N140
  N77 --> N151
  N77 --> N152
  N77 --> N153
  N77 --> N154
  N77 -. type .-> N167
  N78 --> N42
  N78 --> N52
  N78 --> N64
  N78 -->|dynamic| N89
  N78 -. type .-> N176
  N79 --> N49
  N79 -. type .-> N138
  N79 --> N155
  N79 -. type .-> N174
  N80 --> N50
  N80 --> N156
  N81 --> N57
  N81 --> N157
  N82 --> N51
  N82 -. type .-> N138
  N82 --> N158
  N82 -. type .-> N175
  N83 --> N42
  N83 --> N128
  N83 --> N129
  N83 --> N130
  N83 --> N134
  N83 --> N137
  N83 --> N165
  N83 -. type .-> N179
  N83 --> N182
  N84 --> N57
  N84 --> N61
  N84 --> N74
  N84 --> N94
  N84 --> N128
  N84 --> N129
  N84 --> N130
  N84 --> N133
  N84 --> N168
  N84 -. type .-> N172
  N85 --> N53
  N85 --> N159
  N86 --> N35
  N86 --> N42
  N86 --> N57
  N86 -. type .-> N160
  N86 --> N160
  N87 --> N41
  N87 --> N57
  N87 --> N161
  N87 -. type .-> N178
  N88 --> N54
  N88 --> N162
  N89 --> N90
  N89 -. type .-> N91
  N89 --> N177
  N90 -. type .-> N91
  N90 --> N128
  N90 --> N129
  N90 --> N130
  N90 -. type .-> N177
  N91 -. type .-> N128
  N91 -. type .-> N132
  N91 --> N137
  N91 -. type .-> N177
  N92 --> N43
  N92 -->|dynamic| N93
  N92 --> N129
  N92 --> N130
  N92 -. type .-> N137
  N92 --> N166
  N92 -. type .-> N170
  N92 -. type .-> N179
  N92 --> N181
  N93 --> N42
  N93 -->|dynamic| N124
  N93 --> N125
  N93 -->|dynamic| N126
  N93 -->|dynamic| N128
  N94 --> N132
  N97 --> N2
  N97 --> N4
  N97 -. type .-> N119
  N97 --> N120
  N97 --> N135
  N97 --> N136
  N97 --> N193
  N97 --> N196
  N96 --> N10
  N96 --> N120
  N98 --> N11
  N98 --> N120
  N99 --> N120
  N100 --> N30
  N100 -. type .-> N55
  N100 --> N56
  N100 --> N120
  N101 --> N27
  N101 --> N31
  N101 --> N42
  N101 -. type .-> N55
  N101 --> N56
  N101 --> N117
  N101 --> N118
  N101 --> N120
  N102 -. type .-> N55
  N102 --> N56
  N102 --> N57
  N102 --> N120
  N102 --> N130
  N102 --> N171
  N102 --> N177
  N103 --> N41
  N103 --> N42
  N103 -. type .-> N55
  N103 --> N56
  N103 --> N120
  N103 --> N178
  N104 --> N12
  N104 --> N120
  N105 --> N120
  N105 --> N189
  N106 -->|dynamic| N17
  N106 --> N120
  N107 --> N120
  N108 --> N3
  N108 --> N120
  N109 --> N13
  N109 --> N120
  N110 --> N14
  N110 --> N120
  N111 -->|dynamic| N16
  N111 --> N120
  N111 --> N192
  N112 --> N15
  N112 --> N120
  N113 --> N5
  N113 --> N8
  N113 --> N20
  N113 --> N23
  N113 --> N24
  N113 --> N25
  N113 --> N26
  N113 --> N28
  N113 --> N95
  N113 --> N119
  N113 --> N120
  N113 --> N135
  N113 -. type .-> N169
  N113 --> N184
  N113 --> N185
  N113 --> N186
  N113 --> N187
  N113 --> N188
  N113 -. type .-> N190
  N113 -. type .-> N191
  N113 --> N194
  N114 --> N6
  N114 --> N7
  N114 --> N9
  N114 --> N18
  N114 --> N29
  N114 --> N113
  N114 --> N120
  N114 -. type .-> N135
  N114 --> N191
  N114 --> N195
  N115 --> N114
  N115 --> N120
  N115 --> N192
  N116 --> N10
  N116 --> N120
```
