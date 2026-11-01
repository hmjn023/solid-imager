# solid-imager dependencies: Apps and shared packages

Generated 2026-11-01 from dependency-boundary fixes based on `b22d4dd6`. Indexion 0.19.0 output was checked and completed with a TypeScript/JavaScript AST scan. See the [method and findings](dependency-audit-2026-11-01.md).

Solid arrows: value imports/re-exports. Dotted arrows: explicit type-only references. `dynamic`: literal `import()` / `require()`. External modules use `external:`; workspace aliases are resolved to source files. Repeated `(source, target, kind)` edges are collapsed. These are source references, not bundler reachability results.

927 edges; at most 450 edges per Mermaid block.

## Part 1

```mermaid
flowchart LR
  N0["apps/cli/src/commands/ai.test.ts"]
  N1["apps/cli/src/commands/ai.ts"]
  N2["apps/cli/src/commands/db.ts"]
  N3["apps/cli/src/commands/job.ts"]
  N4["apps/cli/src/commands/media.test.ts"]
  N5["apps/cli/src/commands/media.ts"]
  N6["apps/cli/src/index.ts"]
  N7["apps/cli/src/orpc-client.ts"]
  N8["apps/cli/src/utils.ts"]
  N9["apps/tauri/src/api/entities-api.ts"]
  N10["apps/tauri/src/api/media-api.ts"]
  N11["apps/tauri/src/api/sources-api.ts"]
  N12["apps/tauri/src/collections/authors-collection.ts"]
  N13["apps/tauri/src/collections/characters-collection.ts"]
  N14["apps/tauri/src/collections/index.ts"]
  N15["apps/tauri/src/collections/ips-collection.ts"]
  N16["apps/tauri/src/collections/projects-collection.ts"]
  N17["apps/tauri/src/collections/query-keys.ts"]
  N18["apps/tauri/src/collections/sources-collection.ts"]
  N19["apps/tauri/src/collections/tags-collection.ts"]
  N20["apps/tauri/src/components/imports/import-review-modal.tsx"]
  N21["apps/tauri/src/components/imports/pending-downloads-indicator.tsx"]
  N22["apps/tauri/src/components/media/ai-tagging-modal.tsx"]
  N23["apps/tauri/src/components/media/character-crop-modal.tsx"]
  N24["apps/tauri/src/components/media/media-actions.tsx"]
  N25["apps/tauri/src/components/media/media-grid-item.tsx"]
  N26["apps/tauri/src/components/media/media-sidebar/index.tsx"]
  N27["apps/tauri/src/components/media/media-sidebar/media-sidebar-content.tsx"]
  N28["apps/tauri/src/components/media/media-viewer.tsx"]
  N29["apps/tauri/src/components/media/move-copy-media-dialog.tsx"]
  N30["apps/tauri/src/components/media/thumbnail-image.tsx"]
  N31["apps/tauri/src/components/server-settings-screen.tsx"]
  N32["apps/tauri/src/components/upload-media-modal/index.tsx"]
  N33["apps/tauri/src/components/upload-media-modal/upload-media-modal-content.tsx"]
  N34["apps/tauri/src/hooks/use-batch-job-events.ts"]
  N35["apps/tauri/src/hooks/use-current-search-persistence.ts"]
  N36["apps/tauri/src/hooks/use-media-source-events.ts"]
  N37["apps/tauri/src/index.css"]
  N38["apps/tauri/src/infrastructure/api-base.ts"]
  N39["apps/tauri/src/infrastructure/api-clients/ai-api.ts"]
  N40["apps/tauri/src/infrastructure/api-clients/characters-api.ts"]
  N41["apps/tauri/src/infrastructure/api-clients/imports-api.ts"]
  N42["apps/tauri/src/infrastructure/api-clients/ips-api.ts"]
  N43["apps/tauri/src/infrastructure/api-clients/media-api.ts"]
  N44["apps/tauri/src/infrastructure/api-clients/orpc-client.ts"]
  N45["apps/tauri/src/infrastructure/api-clients/projects-api.ts"]
  N46["apps/tauri/src/infrastructure/api-clients/search-api.ts"]
  N47["apps/tauri/src/infrastructure/api-clients/sources-api.ts"]
  N48["apps/tauri/src/infrastructure/api-clients/thumbnails-api.ts"]
  N49["apps/tauri/src/infrastructure/api/clients/preset-client.ts"]
  N50["apps/tauri/src/infrastructure/api/clients/search-history-client.ts"]
  N51["apps/tauri/src/infrastructure/db/database-files.ts"]
  N52["apps/tauri/src/infrastructure/db/persistence.ts"]
  N53["apps/tauri/src/infrastructure/media/thumbnail-runtime.ts"]
  N54["apps/tauri/src/infrastructure/settings/server-health.ts"]
  N55["apps/tauri/src/infrastructure/settings/server-settings.ts"]
  N56["apps/tauri/src/infrastructure/tauri-fetch-helpers.ts"]
  N57["apps/tauri/src/main.tsx"]
  N58["apps/tauri/src/orpc-client.ts"]
  N59["apps/tauri/src/presentation/store/search-store.ts"]
  N60["apps/tauri/src/queries/index.ts"]
  N61["apps/tauri/src/query-client.ts"]
  N62["apps/tauri/src/routeTree.gen.ts"]
  N63["apps/tauri/src/router.tsx"]
  N64["apps/tauri/src/routes/$.tsx"]
  N65["apps/tauri/src/routes/__root.tsx"]
  N66["apps/tauri/src/routes/about.tsx"]
  N67["apps/tauri/src/routes/config.tsx"]
  N68["apps/tauri/src/routes/index.tsx"]
  N69["apps/tauri/src/routes/jobs.tsx"]
  N70["apps/tauri/src/routes/manager.tsx"]
  N71["apps/tauri/src/routes/search.tsx"]
  N72["apps/tauri/src/routes/servers.tsx"]
  N73["apps/tauri/src/routes/sources/$mediaSourceId/$mediaId/index.tsx"]
  N74["apps/tauri/src/routes/sources/$mediaSourceId/components/-source-media-page.tsx"]
  N75["apps/tauri/src/routes/sources/$mediaSourceId/index.tsx"]
  N76["apps/tauri/src/routes/sources/index.tsx"]
  N77["apps/xtracter/src/api.ts"]
  N78["apps/xtracter/src/background/index.test.ts"]
  N79["apps/xtracter/src/background/index.ts"]
  N80["apps/xtracter/src/content/danbooru.test.ts"]
  N81["apps/xtracter/src/content/danbooru.ts"]
  N82["apps/xtracter/src/content/fanbox.ts"]
  N83["apps/xtracter/src/content/index.ts"]
  N84["apps/xtracter/src/content/twitter-account-cache.ts"]
  N85["apps/xtracter/src/content/twitter-identities.test.ts"]
  N86["apps/xtracter/src/content/twitter-identities.ts"]
  N87["apps/xtracter/src/content/twitter-network.ts"]
  N88["apps/xtracter/src/content/twitter-verification.test.ts"]
  N89["apps/xtracter/src/content/twitter.test.ts"]
  N90["apps/xtracter/src/content/twitter.ts"]
  N91["apps/xtracter/src/popup/index.tsx"]
  N92["apps/xtracter/src/schema.ts"]
  N93["apps/xtracter/src/utils/dom-utils.ts"]
  N94["apps/xtracter/src/utils/source-selection.test.ts"]
  N95["apps/xtracter/src/utils/source-selection.ts"]
  N96["external:@orpc/solid-query"]
  N97["external:@tanstack/db"]
  N98["external:@tanstack/query-db-collection"]
  N99["external:@tanstack/solid-db"]
  N100["external:@tanstack/solid-query"]
  N101["external:@tanstack/solid-router"]
  N102["external:@tanstack/tauri-db-sqlite-persistence"]
  N103["external:@tauri-apps/api/core"]
  N104["external:@tauri-apps/plugin-http"]
  N105["external:@tauri-apps/plugin-sql"]
  N106["external:@tauri-apps/plugin-store"]
  N107["external:incur"]
  N108["external:node:child_process"]
  N109["external:node:fs"]
  N110["external:node:path"]
  N111["external:node:stream"]
  N112["external:node:stream/promises"]
  N113["external:solid-js"]
  N114["external:solid-js/web"]
  N115["external:vitest"]
  N116["external:zod"]
  N117["packages/application/src/index.ts"]
  N118["packages/application/src/ports/author-service.ts"]
  N119["packages/application/src/ports/category-service.ts"]
  N120["packages/application/src/ports/ccip-vector-store.ts"]
  N121["packages/application/src/ports/character-clustering-results-store.ts"]
  N122["packages/application/src/ports/character-service.ts"]
  N123["packages/application/src/ports/collection-service.ts"]
  N124["packages/application/src/ports/embedding-store.ts"]
  N125["packages/application/src/ports/index.ts"]
  N126["packages/application/src/ports/ip-service.ts"]
  N127["packages/application/src/ports/media-processing-service.ts"]
  N128["packages/application/src/ports/media-service.ts"]
  N129["packages/application/src/ports/preset-service.ts"]
  N130["packages/application/src/ports/project-service.ts"]
  N131["packages/application/src/ports/search-service.ts"]
  N132["packages/application/src/ports/search-snapshot-service.ts"]
  N133["packages/application/src/ports/tag-service.ts"]
  N134["packages/application/src/ports/tagging-service.ts"]
  N135["packages/application/src/ports/thumbnail-service.ts"]
  N136["packages/application/src/ports/user-service.ts"]
  N137["packages/application/src/services/index.ts"]
  N138["packages/application/src/utils/hash-utils.ts"]
  N139["packages/client/src/index.ts"]
  N140["packages/core/src/domain/authors/schemas.ts"]
  N141["packages/core/src/domain/categories/schemas.ts"]
  N142["packages/core/src/domain/characters/schemas.ts"]
  N143["packages/core/src/domain/collections/schemas.ts"]
  N144["packages/core/src/domain/contract/index.ts"]
  N145["packages/core/src/domain/contract/presets-client.ts"]
  N146["packages/core/src/domain/contract/search-snapshots-client.ts"]
  N147["packages/core/src/domain/interfaces/transaction-manager.ts"]
  N148["packages/core/src/domain/ips/schemas.ts"]
  N149["packages/core/src/domain/jobs/schemas.ts"]
  N150["packages/core/src/domain/media/schemas.ts"]
  N151["packages/core/src/domain/media/utils/filename-utils.ts"]
  N152["packages/core/src/domain/repositories/category-repository.ts"]
  N153["packages/core/src/domain/search/embedding.ts"]
  N154["packages/core/src/domain/sources/schemas.ts"]
  N155["packages/core/src/domain/tagging/schemas.ts"]
  N156["packages/core/src/utils/index.ts"]
  N157["packages/ui/src/ai-tagging-modal.tsx"]
  N158["packages/ui/src/badge.tsx"]
  N159["packages/ui/src/bulk-action-dialog.tsx"]
  N160["packages/ui/src/button.tsx"]
  N161["packages/ui/src/card.tsx"]
  N162["packages/ui/src/character-crop-modal.tsx"]
  N163["packages/ui/src/dialog.tsx"]
  N164["packages/ui/src/event-stream.ts"]
  N165["packages/ui/src/hooks/batch-job-events.types.ts"]
  N166["packages/ui/src/hooks/use-batch-job-events.ts"]
  N167["packages/ui/src/hooks/use-current-search-persistence.ts"]
  N168["packages/ui/src/hooks/use-job-events.ts"]
  N169["packages/ui/src/hooks/use-manager-page.ts"]
  N170["packages/ui/src/hooks/use-media-collection-selection.ts"]
  N171["packages/ui/src/hooks/use-media-source-events.ts"]
  N172["packages/ui/src/hooks/use-search-history-persistence.ts"]
  N173["packages/ui/src/hooks/use-search-page.ts"]
  N174["packages/ui/src/hooks/use-source-root-path.ts"]
  N175["packages/ui/src/hooks/use-sources-events.ts"]
  N176["packages/ui/src/hooks/use-sources-page.ts"]
  N177["packages/ui/src/import-review-modal.tsx"]
  N178["packages/ui/src/input.tsx"]
  N179["packages/ui/src/label.tsx"]
  N180["packages/ui/src/layouts/app-shell.tsx"]
  N181["packages/ui/src/media-actions.tsx"]
  N182["packages/ui/src/media-context.ts"]
  N183["packages/ui/src/media-detail-header.tsx"]
  N184["packages/ui/src/media-grid-item-link.tsx"]
  N185["packages/ui/src/media-grid-item.tsx"]
  N186["packages/ui/src/media-sidebar-content.tsx"]
  N187["packages/ui/src/media-viewer.tsx"]
  N188["packages/ui/src/move-copy-media-dialog.tsx"]
  N189["packages/ui/src/oppai-oracle-modal.tsx"]
  N190["packages/ui/src/pending-downloads-indicator.tsx"]
  N191["packages/ui/src/preset-client.ts"]
  N192["packages/ui/src/query-options/index.ts"]
  N193["packages/ui/src/query-state.ts"]
  N194["packages/ui/src/router-status.tsx"]
  N195["packages/ui/src/screens/about-screen.tsx"]
  N196["packages/ui/src/screens/config-state-screen.tsx"]
  N197["packages/ui/src/screens/jobs-screen.tsx"]
  N198["packages/ui/src/screens/manager-screen.tsx"]
  N199["packages/ui/src/screens/manager/types.ts"]
  N200["packages/ui/src/screens/media-detail-screen.tsx"]
  N201["packages/ui/src/screens/not-found-screen.tsx"]
  N202["packages/ui/src/screens/search-screen.tsx"]
  N203["packages/ui/src/search-history-client.ts"]
  N204["packages/ui/src/search-history-route.ts"]
  N205["packages/ui/src/shortcuts/index.ts"]
  N206["packages/ui/src/source-media-page.tsx"]
  N207["packages/ui/src/stores/search-store.ts"]
  N208["packages/ui/src/thumbnail-image.tsx"]
  N209["packages/ui/src/thumbnail-source.ts"]
  N210["packages/ui/src/toast.tsx"]
  N211["packages/ui/src/upload-media-modal-content.tsx"]
  N212["packages/ui/src/workspace/management-layout.tsx"]
  N0 --> N1
  N0 --> N7
  N0 --> N115
  N1 -. type .-> N5
  N1 --> N7
  N1 --> N8
  N1 --> N107
  N2 --> N8
  N2 --> N107
  N2 --> N108
  N2 --> N109
  N2 --> N110
  N3 --> N8
  N3 --> N107
  N4 --> N5
  N4 --> N7
  N4 --> N109
  N4 --> N115
  N5 --> N7
  N5 --> N8
  N5 --> N107
  N5 --> N109
  N5 --> N110
  N5 --> N111
  N5 --> N112
  N6 --> N1
  N6 --> N2
  N6 --> N3
  N6 --> N5
  N6 --> N7
  N6 --> N8
  N6 --> N107
  N7 --> N139
  N7 -. type .-> N144
  N8 --> N107
  N8 --> N156
  N9 --> N58
  N10 --> N58
  N11 --> N58
  N11 -. type .-> N116
  N11 -. type .-> N154
  N12 --> N17
  N12 -. type .-> N52
  N12 --> N58
  N12 --> N61
  N12 --> N97
  N12 --> N98
  N12 --> N102
  N13 --> N17
  N13 -. type .-> N52
  N13 --> N58
  N13 --> N61
  N13 --> N97
  N13 --> N98
  N13 --> N102
  N14 --> N12
  N14 --> N13
  N14 --> N15
  N14 --> N16
  N14 --> N18
  N14 --> N19
  N14 --> N52
  N14 --> N55
  N15 --> N17
  N15 -. type .-> N52
  N15 --> N58
  N15 --> N61
  N15 --> N97
  N15 --> N98
  N15 --> N102
  N16 --> N17
  N16 -. type .-> N52
  N16 --> N58
  N16 --> N61
  N16 --> N97
  N16 --> N98
  N16 --> N102
  N18 --> N17
  N18 -. type .-> N52
  N18 --> N58
  N18 --> N61
  N18 --> N97
  N18 --> N98
  N18 --> N102
  N19 --> N17
  N19 -. type .-> N52
  N19 --> N58
  N19 --> N61
  N19 --> N97
  N19 --> N98
  N19 --> N102
  N20 --> N41
  N20 --> N47
  N20 --> N177
  N21 --> N41
  N21 --> N44
  N21 --> N47
  N21 --> N164
  N21 --> N190
  N22 --> N44
  N22 --> N157
  N23 --> N44
  N23 -. type .-> N150
  N23 --> N162
  N24 --> N22
  N24 --> N23
  N24 --> N34
  N24 --> N43
  N24 --> N53
  N24 --> N56
  N24 --> N58
  N24 --> N101
  N24 -. type .-> N150
  N24 --> N181
  N24 --> N189
  N24 --> N207
  N25 --> N30
  N25 -. type .-> N150
  N25 --> N184
  N25 --> N185
  N26 --> N27
  N27 --> N40
  N27 --> N42
  N27 --> N43
  N27 --> N45
  N27 --> N60
  N27 -. type .-> N113
  N27 -. type .-> N150
  N27 --> N186
  N28 --> N53
  N28 --> N56
  N28 --> N113
  N28 -. type .-> N150
  N28 --> N187
  N29 --> N47
  N29 --> N113
  N29 -. type .-> N154
  N29 --> N188
  N30 --> N53
  N30 -. type .-> N150
  N30 --> N208
  N30 --> N209
  N31 --> N54
  N31 --> N55
  N31 --> N113
  N31 --> N158
  N31 --> N160
  N31 --> N161
  N31 --> N178
  N31 --> N179
  N32 --> N33
  N33 --> N211
  N34 --> N44
  N34 -. type .-> N113
  N34 -. type .-> N165
  N34 --> N166
  N35 --> N167
  N36 --> N44
  N36 --> N113
  N36 -. type .-> N171
  N36 --> N171
  N39 --> N58
  N40 --> N9
  N40 --> N58
  N41 --> N58
  N42 --> N9
  N42 --> N58
  N43 --> N10
  N43 --> N46
  N43 --> N58
  N43 -. type .-> N150
  N44 --> N58
  N45 --> N9
  N45 --> N58
  N46 --> N58
  N46 -. type .-> N150
  N46 -. type .-> N153
  N47 --> N11
  N47 --> N58
  N47 --> N139
  N48 --> N44
  N49 --> N58
  N49 -. type .-> N145
  N50 --> N58
  N50 -. type .-> N146
  N51 --> N103
  N52 --> N51
  N52 --> N102
  N52 --> N105
  N53 --> N56
  N54 --> N104
  N55 --> N38
  N55 --> N51
  N55 --> N52
  N55 --> N106
  N55 --> N116
  N56 --> N38
  N56 --> N104
  N57 --> N14
  N57 --> N31
  N57 --> N37
  N57 --> N55
  N57 --> N58
  N57 --> N63
  N57 --> N101
  N57 --> N113
  N57 --> N114
  N57 --> N180
  N57 --> N194
  N58 --> N38
  N58 --> N104
  N58 --> N139
  N58 -. type .-> N144
  N59 --> N207
  N60 --> N58
  N60 --> N96
  N60 -. type .-> N149
  N60 --> N192
  N61 --> N100
  N61 --> N139
  N61 --> N192
  N63 --> N61
  N63 --> N62
  N63 --> N100
  N63 --> N101
  N63 --> N194
  N63 --> N201
  N65 --> N14
  N65 --> N17
  N65 --> N21
  N65 --> N38
  N65 --> N44
  N65 --> N47
  N65 -. type .-> N63
  N65 --> N99
  N65 --> N100
  N65 --> N101
  N65 --> N154
  N65 --> N164
  N65 -. type .-> N175
  N65 --> N176
  N65 --> N180
  N65 --> N194
  N65 --> N205
  N65 --> N210
  N64 --> N101
  N64 --> N201
  N66 --> N38
  N66 --> N101
  N66 --> N195
  N67 --> N44
  N67 --> N60
  N67 --> N100
  N67 --> N101
  N67 --> N192
  N67 --> N193
  N67 --> N196
  N68 --> N101
  N69 --> N44
  N69 --> N53
  N69 --> N60
  N69 --> N100
  N69 --> N101
  N69 --> N113
  N69 --> N139
  N69 -. type .-> N149
  N69 --> N168
  N69 --> N192
  N69 --> N193
  N69 --> N197
  N69 --> N210
  N70 --> N34
  N70 --> N39
  N70 --> N40
  N70 --> N42
  N70 --> N43
  N70 --> N45
  N70 --> N47
  N70 --> N48
  N70 --> N56
  N70 --> N58
  N70 --> N60
  N70 --> N100
  N70 --> N101
  N70 --> N103
  N70 --> N139
  N70 --> N169
  N70 --> N192
  N70 --> N198
  N70 -. type .-> N199
  N70 --> N210
  N71 --> N25
  N71 --> N29
  N71 --> N30
  N71 --> N36
  N71 --> N43
  N71 --> N46
  N71 --> N47
  N71 --> N49
  N71 --> N50
  N71 --> N59
  N71 --> N60
  N71 --> N101
  N71 --> N113
  N71 -. type .-> N150
  N71 --> N156
  N71 --> N159
  N71 --> N160
  N71 --> N163
  N71 --> N167
  N71 --> N170
  N71 --> N172
  N71 --> N173
  N71 --> N182
  N71 --> N191
  N71 --> N202
  N71 --> N203
  N71 --> N204
  N71 --> N207
  N71 --> N210
  N72 --> N31
  N72 --> N55
  N72 --> N101
  N72 --> N212
  N73 --> N24
  N73 --> N26
  N73 --> N28
  N73 --> N36
  N73 --> N60
  N73 --> N100
  N73 --> N101
  N73 --> N113
  N73 --> N174
  N73 --> N183
  N73 --> N192
  N73 --> N194
  N73 --> N200
  N74 --> N25
  N74 --> N29
  N74 --> N32
  N74 --> N36
  N74 --> N43
  N74 --> N46
  N74 --> N47
  N74 --> N49
  N74 --> N50
  N74 --> N53
  N74 --> N59
  N74 --> N60
  N74 --> N100
  N74 --> N101
  N74 --> N113
  N74 -. type .-> N150
  N74 --> N159
  N74 --> N170
  N74 --> N174
  N74 --> N182
  N74 --> N191
  N74 --> N203
  N74 --> N206
  N74 --> N207
  N75 --> N60
  N75 --> N74
  N75 --> N101
  N75 --> N204
  N76 --> N101
  N76 --> N201
  N62 --> N65
  N62 --> N64
  N62 --> N66
  N62 --> N67
  N62 --> N68
  N62 --> N69
  N62 --> N70
  N62 --> N71
  N62 --> N72
  N62 --> N73
  N62 --> N75
  N62 --> N76
  N77 --> N139
  N77 -. type .-> N144
  N78 -. type .-> N77
  N78 -->|dynamic| N79
  N78 --> N115
  N79 --> N77
  N79 -. type .-> N92
  N79 --> N92
  N79 --> N95
  N79 --> N151
  N79 -. type .-> N154
  N80 --> N81
  N80 --> N115
  N81 -. type .-> N92
  N81 --> N93
  N82 -. type .-> N92
  N82 --> N93
  N83 --> N81
  N83 --> N82
  N83 --> N84
  N83 --> N90
  N83 -. type .-> N92
  N84 -. type .-> N86
  N84 -. type .-> N92
  N85 --> N86
  N85 --> N115
  N87 --> N86
  N88 -->|dynamic| N84
  N88 -->|dynamic| N87
  N88 --> N115
  N89 --> N90
  N89 --> N115
  N90 -. type .-> N92
  N90 --> N93
  N91 --> N77
  N91 --> N92
  N91 --> N95
  N91 --> N113
  N91 --> N114
  N92 --> N116
  N92 --> N140
  N94 --> N95
  N94 --> N115
  N117 -. type .-> N125
  N117 --> N137
  N117 --> N138
  N118 -. type .-> N140
  N119 -. type .-> N141
  N119 -. type .-> N152
  N121 -. type .-> N142
  N122 -. type .-> N142
  N123 -. type .-> N143
  N124 -. type .-> N155
  N125 -. type .-> N118
  N125 -. type .-> N119
  N125 -. type .-> N120
  N125 -. type .-> N122
  N125 -. type .-> N123
  N125 -. type .-> N126
  N125 -. type .-> N127
  N125 -. type .-> N128
  N125 -. type .-> N129
  N125 -. type .-> N130
  N125 -. type .-> N131
  N125 -. type .-> N132
  N125 -. type .-> N133
  N125 -. type .-> N134
  N125 -. type .-> N135
  N125 -. type .-> N136
  N126 -. type .-> N148
  N127 -. type .-> N147
```

## Part 2

```mermaid
flowchart LR
  N0["external:@orpc/client"]
  N1["external:@orpc/client/fetch"]
  N2["external:@orpc/contract"]
  N3["external:drizzle-orm"]
  N4["external:drizzle-orm/bun-sql"]
  N5["external:drizzle-orm/node-postgres"]
  N6["external:drizzle-orm/pglite"]
  N7["external:node:crypto"]
  N8["external:node:fs"]
  N9["external:node:path"]
  N10["external:node:stream/promises"]
  N11["external:vitest"]
  N12["external:zod"]
  N13["packages/application/src/ports/author-service.ts"]
  N14["packages/application/src/ports/category-service.ts"]
  N15["packages/application/src/ports/ccip-vector-store.ts"]
  N16["packages/application/src/ports/character-clustering-results-store.ts"]
  N17["packages/application/src/ports/character-service.ts"]
  N18["packages/application/src/ports/collection-service.ts"]
  N19["packages/application/src/ports/embedding-store.ts"]
  N20["packages/application/src/ports/ip-service.ts"]
  N21["packages/application/src/ports/media-processing-service.ts"]
  N22["packages/application/src/ports/media-service.ts"]
  N23["packages/application/src/ports/preset-service.ts"]
  N24["packages/application/src/ports/project-service.ts"]
  N25["packages/application/src/ports/search-service.ts"]
  N26["packages/application/src/ports/search-snapshot-service.ts"]
  N27["packages/application/src/ports/tag-service.ts"]
  N28["packages/application/src/ports/tagging-service.ts"]
  N29["packages/application/src/ports/thumbnail-service.ts"]
  N30["packages/application/src/ports/user-service.ts"]
  N31["packages/application/src/services/author-account-verification-service.ts"]
  N32["packages/application/src/services/author-service.ts"]
  N33["packages/application/src/services/category-service.ts"]
  N34["packages/application/src/services/ccip-vector-service.ts"]
  N35["packages/application/src/services/character-clustering-review-service.ts"]
  N36["packages/application/src/services/character-service.ts"]
  N37["packages/application/src/services/collection-service.ts"]
  N38["packages/application/src/services/embedding-search-service.ts"]
  N39["packages/application/src/services/index.ts"]
  N40["packages/application/src/services/ip-service.ts"]
  N41["packages/application/src/services/media-processing-service.ts"]
  N42["packages/application/src/services/media-query-service.ts"]
  N43["packages/application/src/services/media-service.ts"]
  N44["packages/application/src/services/media-transfer-service.ts"]
  N45["packages/application/src/services/media-upload-service.ts"]
  N46["packages/application/src/services/preset-service.ts"]
  N47["packages/application/src/services/project-service.ts"]
  N48["packages/application/src/services/search-service.ts"]
  N49["packages/application/src/services/search-snapshot-service.ts"]
  N50["packages/application/src/services/tag-service.ts"]
  N51["packages/application/src/services/tagging-service.ts"]
  N52["packages/application/src/services/thumbnail-service.ts"]
  N53["packages/application/src/services/user-service.ts"]
  N54["packages/application/src/utils/hash-utils.ts"]
  N55["packages/client/src/api-error.test.ts"]
  N56["packages/client/src/api-error.ts"]
  N57["packages/client/src/create-client.test.ts"]
  N58["packages/client/src/create-client.ts"]
  N59["packages/client/src/index.ts"]
  N60["packages/client/src/job-artifact.ts"]
  N61["packages/core/src/domain/authors/schemas.ts"]
  N62["packages/core/src/domain/categories/schemas.ts"]
  N63["packages/core/src/domain/characters/clustering-schemas.ts"]
  N64["packages/core/src/domain/characters/schemas.ts"]
  N65["packages/core/src/domain/collections/schemas.ts"]
  N66["packages/core/src/domain/config/config-schema.ts"]
  N67["packages/core/src/domain/contract/ai.contract.ts"]
  N68["packages/core/src/domain/contract/authors.contract.ts"]
  N69["packages/core/src/domain/contract/categories.contract.ts"]
  N70["packages/core/src/domain/contract/characters.contract.ts"]
  N71["packages/core/src/domain/contract/config.contract.ts"]
  N72["packages/core/src/domain/contract/directories.contract.ts"]
  N73["packages/core/src/domain/contract/downloads.contract.ts"]
  N74["packages/core/src/domain/contract/imports.contract.ts"]
  N75["packages/core/src/domain/contract/index.ts"]
  N76["packages/core/src/domain/contract/ips.contract.ts"]
  N77["packages/core/src/domain/contract/jobs.contract.ts"]
  N78["packages/core/src/domain/contract/media.contract.ts"]
  N79["packages/core/src/domain/contract/presets-client.ts"]
  N80["packages/core/src/domain/contract/presets.contract.ts"]
  N81["packages/core/src/domain/contract/projects.contract.ts"]
  N82["packages/core/src/domain/contract/search-snapshots-client.ts"]
  N83["packages/core/src/domain/contract/search-snapshots.contract.ts"]
  N84["packages/core/src/domain/contract/sources.contract.ts"]
  N85["packages/core/src/domain/contract/tags.contract.ts"]
  N86["packages/core/src/domain/contract/thumbnails.contract.ts"]
  N87["packages/core/src/domain/contract/utils.contract.ts"]
  N88["packages/core/src/domain/errors/index.ts"]
  N89["packages/core/src/domain/events/index.ts"]
  N90["packages/core/src/domain/events/media-source-events.ts"]
  N91["packages/core/src/domain/interfaces/ai-client.ts"]
  N92["packages/core/src/domain/interfaces/transaction-manager.ts"]
  N93["packages/core/src/domain/ips/schemas.ts"]
  N94["packages/core/src/domain/jobs/schemas.ts"]
  N95["packages/core/src/domain/media/schemas.ts"]
  N96["packages/core/src/domain/media/upload-schemas.ts"]
  N97["packages/core/src/domain/media/utils/filename-utils.ts"]
  N98["packages/core/src/domain/media/utils/media-type-utils.ts"]
  N99["packages/core/src/domain/media/utils/metadata-utils.ts"]
  N100["packages/core/src/domain/projects/schemas.ts"]
  N101["packages/core/src/domain/repositories/author-repository.ts"]
  N102["packages/core/src/domain/repositories/category-repository.ts"]
  N103["packages/core/src/domain/repositories/character-repository.ts"]
  N104["packages/core/src/domain/repositories/collection-repository.ts"]
  N105["packages/core/src/domain/repositories/ip-repository.ts"]
  N106["packages/core/src/domain/repositories/job-repository.ts"]
  N107["packages/core/src/domain/repositories/media-repository.ts"]
  N108["packages/core/src/domain/repositories/preset-repository.ts"]
  N109["packages/core/src/domain/repositories/project-repository.ts"]
  N110["packages/core/src/domain/repositories/search-snapshot-repository.ts"]
  N111["packages/core/src/domain/repositories/source-repository.ts"]
  N112["packages/core/src/domain/repositories/tag-repository.ts"]
  N113["packages/core/src/domain/repositories/user-repository.ts"]
  N114["packages/core/src/domain/search/embedding.ts"]
  N115["packages/core/src/domain/search/history.ts"]
  N116["packages/core/src/domain/search/logic.ts"]
  N117["packages/core/src/domain/search/schema.ts"]
  N118["packages/core/src/domain/services/image-processor.ts"]
  N119["packages/core/src/domain/services/storage-service.ts"]
  N120["packages/core/src/domain/shared/schemas.ts"]
  N121["packages/core/src/domain/sources/events.ts"]
  N122["packages/core/src/domain/sources/schemas.ts"]
  N123["packages/core/src/domain/tagging/constants.ts"]
  N124["packages/core/src/domain/tagging/schemas.ts"]
  N125["packages/core/src/domain/tags/extractor.ts"]
  N126["packages/core/src/domain/tags/schemas.ts"]
  N127["packages/core/src/domain/thumbnails/schemas.ts"]
  N128["packages/core/src/domain/users/schemas.ts"]
  N129["packages/core/src/index.ts"]
  N130["packages/core/src/interfaces/config-service.ts"]
  N131["packages/core/src/interfaces/file-system.ts"]
  N132["packages/core/src/interfaces/media-storage.ts"]
  N133["packages/core/src/utils/async-pool.ts"]
  N134["packages/core/src/utils/deep-equal.ts"]
  N135["packages/core/src/utils/get-error-message.ts"]
  N136["packages/core/src/utils/index.ts"]
  N137["packages/core/src/utils/type-guards.ts"]
  N138["packages/db/src/errors.ts"]
  N139["packages/db/src/index.ts"]
  N140["packages/db/src/repositories/author-repository.ts"]
  N141["packages/db/src/repositories/category-repository.ts"]
  N142["packages/db/src/repositories/character-repository.ts"]
  N143["packages/db/src/repositories/collection-repository.ts"]
  N144["packages/db/src/repositories/ip-repository.ts"]
  N145["packages/db/src/repositories/job-repository.test.ts"]
  N146["packages/db/src/repositories/job-repository.ts"]
  N147["packages/db/src/repositories/media-repository-utils.ts"]
  N148["packages/db/src/repositories/media-repository.ts"]
  N149["packages/db/src/repositories/preset-repository.ts"]
  N150["packages/db/src/repositories/project-repository.ts"]
  N151["packages/db/src/repositories/search-snapshot-repository.ts"]
  N152["packages/db/src/repositories/source-repository.ts"]
  N153["packages/db/src/repositories/tag-repository.ts"]
  N154["packages/db/src/repositories/user-repository.ts"]
  N155["packages/db/src/schema.ts"]
  N156["packages/db/src/transaction-manager.ts"]
  N157["packages/db/src/types.ts"]
  N21 -. type .-> N95
  N21 -. type .-> N106
  N22 -. type .-> N92
  N22 -. type .-> N95
  N22 -. type .-> N96
  N22 -. type .-> N121
  N23 -. type .-> N95
  N24 -. type .-> N100
  N25 -. type .-> N95
  N26 -. type .-> N115
  N27 -. type .-> N112
  N27 -. type .-> N126
  N28 -. type .-> N124
  N29 -. type .-> N127
  N30 -. type .-> N128
  N31 -. type .-> N13
  N31 -. type .-> N61
  N31 --> N88
  N32 -. type .-> N13
  N32 -. type .-> N92
  N32 -. type .-> N95
  N32 -. type .-> N101
  N33 -. type .-> N14
  N33 -. type .-> N62
  N33 -. type .-> N102
  N34 -. type .-> N15
  N34 -. type .-> N22
  N34 -. type .-> N28
  N34 -. type .-> N95
  N34 -. type .-> N107
  N34 -. type .-> N111
  N34 --> N133
  N35 -. type .-> N16
  N35 --> N64
  N35 --> N88
  N36 -. type .-> N17
  N36 -. type .-> N64
  N36 --> N88
  N36 -. type .-> N92
  N36 -. type .-> N103
  N36 -. type .-> N105
  N37 -. type .-> N18
  N37 -. type .-> N65
  N37 -. type .-> N104
  N38 --> N9
  N38 -. type .-> N19
  N38 -. type .-> N95
  N38 -. type .-> N107
  N38 -. type .-> N111
  N38 -. type .-> N114
  N38 --> N114
  N38 --> N122
  N39 -. type .-> N25
  N39 --> N32
  N39 --> N33
  N39 --> N34
  N39 --> N36
  N39 --> N37
  N39 --> N40
  N39 --> N41
  N39 --> N42
  N39 --> N43
  N39 --> N44
  N39 --> N45
  N39 --> N46
  N39 --> N47
  N39 --> N48
  N39 --> N49
  N39 --> N50
  N39 --> N51
  N39 --> N52
  N39 --> N53
  N40 -. type .-> N20
  N40 -. type .-> N93
  N40 -. type .-> N105
  N41 --> N9
  N41 -. type .-> N21
  N41 -. type .-> N22
  N41 -. type .-> N64
  N41 -. type .-> N92
  N41 -. type .-> N95
  N41 -. type .-> N101
  N41 -. type .-> N103
  N41 -. type .-> N105
  N41 -. type .-> N106
  N41 -. type .-> N107
  N41 -. type .-> N109
  N41 -. type .-> N111
  N41 -. type .-> N112
  N41 -. type .-> N118
  N41 -. type .-> N121
  N41 --> N122
  N41 -. type .-> N132
  N41 --> N137
  N42 --> N9
  N42 -. type .-> N22
  N42 --> N88
  N42 --> N95
  N42 --> N98
  N42 -. type .-> N107
  N42 -. type .-> N111
  N42 -. type .-> N112
  N42 -. type .-> N118
  N42 --> N122
  N42 -. type .-> N129
  N43 -. type .-> N22
  N43 -. type .-> N42
  N43 -. type .-> N44
  N43 -. type .-> N45
  N43 -. type .-> N92
  N43 -. type .-> N95
  N43 -. type .-> N96
  N44 --> N9
  N44 -. type .-> N22
  N44 --> N88
  N44 -. type .-> N92
  N44 --> N95
  N44 -. type .-> N101
  N44 -. type .-> N103
  N44 -. type .-> N105
  N44 -. type .-> N106
  N44 -. type .-> N107
  N44 -. type .-> N109
  N44 -. type .-> N111
  N44 --> N122
  N44 -. type .-> N129
  N45 --> N9
  N45 --> N88
  N45 --> N95
  N45 --> N96
  N45 --> N98
  N45 -. type .-> N106
  N45 -. type .-> N107
  N45 -. type .-> N111
  N45 --> N122
  N45 -. type .-> N129
  N46 -. type .-> N23
  N46 --> N88
  N46 -. type .-> N95
  N46 -. type .-> N108
  N47 -. type .-> N24
  N47 -. type .-> N100
  N47 -. type .-> N109
  N48 -. type .-> N25
  N48 -. type .-> N95
  N48 -. type .-> N107
  N49 --> N7
  N49 -. type .-> N26
  N49 --> N88
  N49 -. type .-> N110
  N49 --> N115
  N50 -. type .-> N27
  N50 -. type .-> N112
  N50 -. type .-> N126
  N51 --> N9
  N51 -. type .-> N22
  N51 -. type .-> N28
  N51 -. type .-> N91
  N51 -. type .-> N103
  N51 -. type .-> N105
  N51 -. type .-> N107
  N51 -. type .-> N111
  N51 -. type .-> N112
  N51 -. type .-> N121
  N51 --> N122
  N51 --> N123
  N51 -. type .-> N124
  N52 -. type .-> N29
  N52 -. type .-> N127
  N52 -. type .-> N131
  N53 -. type .-> N30
  N53 -. type .-> N113
  N53 -. type .-> N128
  N54 --> N7
  N54 --> N8
  N54 --> N10
  N55 --> N11
  N55 --> N56
  N57 --> N11
  N57 --> N56
  N57 --> N58
  N58 --> N0
  N58 --> N1
  N58 -. type .-> N2
  N58 --> N56
  N59 -. type .-> N2
  N59 --> N56
  N59 -. type .-> N58
  N59 --> N58
  N59 --> N60
  N61 --> N12
  N62 --> N12
  N63 --> N12
  N64 --> N12
  N64 --> N63
  N65 --> N12
  N66 --> N12
  N67 --> N2
  N67 --> N12
  N67 --> N114
  N67 --> N124
  N68 --> N2
  N68 --> N61
  N69 --> N2
  N69 --> N12
  N69 --> N62
  N70 --> N2
  N70 --> N12
  N70 --> N64
  N71 --> N2
  N71 --> N66
  N72 --> N2
  N72 --> N12
  N73 --> N2
  N73 --> N12
  N73 --> N95
  N74 --> N2
  N74 --> N12
  N74 --> N95
  N74 --> N121
  N75 --> N67
  N75 --> N68
  N75 --> N69
  N75 --> N70
  N75 --> N71
  N75 --> N72
  N75 --> N73
  N75 --> N74
  N75 --> N76
  N75 --> N77
  N75 --> N78
  N75 -. type .-> N79
  N75 --> N80
  N75 --> N81
  N75 -. type .-> N82
  N75 --> N83
  N75 --> N84
  N75 --> N85
  N75 --> N86
  N75 --> N87
  N76 --> N2
  N76 --> N12
  N76 --> N93
  N77 --> N2
  N77 --> N12
  N77 --> N94
  N77 --> N121
  N78 --> N2
  N78 --> N12
  N78 --> N95
  N78 --> N96
  N78 --> N114
  N78 --> N124
  N79 -. type .-> N2
  N79 -. type .-> N80
  N80 --> N2
  N80 --> N12
  N80 --> N95
  N81 --> N2
  N81 --> N12
  N81 --> N100
  N82 -. type .-> N2
  N82 -. type .-> N83
  N83 --> N2
  N83 --> N115
  N84 --> N2
  N84 --> N12
  N84 --> N94
  N84 --> N121
  N84 --> N122
  N85 --> N2
  N85 --> N12
  N85 --> N126
  N86 --> N2
  N86 --> N12
  N86 --> N127
  N87 --> N2
  N87 --> N12
  N89 --> N90
  N90 --> N12
  N91 -. type .-> N124
  N93 --> N12
  N94 --> N12
  N95 --> N12
  N95 -. type .-> N61
  N95 --> N61
  N95 --> N96
  N95 --> N126
  N96 --> N12
  N97 -. type .-> N95
  N99 -. type .-> N95
  N99 --> N125
  N99 --> N126
  N99 --> N137
  N100 --> N12
  N101 -. type .-> N61
  N101 -. type .-> N92
  N102 -. type .-> N62
  N102 -. type .-> N92
  N103 -. type .-> N64
  N103 -. type .-> N92
  N104 -. type .-> N65
  N105 -. type .-> N92
  N105 -. type .-> N93
  N107 -. type .-> N92
  N107 -. type .-> N95
  N108 -. type .-> N95
  N109 -. type .-> N92
  N109 -. type .-> N100
  N110 -. type .-> N115
  N111 -. type .-> N92
  N111 -. type .-> N122
  N112 -. type .-> N92
  N112 -. type .-> N95
  N112 -. type .-> N126
  N113 -. type .-> N128
  N114 --> N12
  N115 --> N12
  N115 --> N117
  N116 -. type .-> N95
  N116 -. type .-> N117
  N117 --> N12
  N117 --> N95
  N117 --> N114
  N119 -. type .-> N12
  N119 -. type .-> N96
  N120 --> N12
  N121 --> N12
  N121 --> N122
  N121 --> N127
  N122 --> N12
  N124 --> N12
  N124 --> N114
  N125 -. type .-> N126
  N125 --> N137
  N126 --> N12
  N127 --> N12
  N128 --> N12
  N129 --> N130
  N129 --> N131
  N129 --> N132
  N130 -. type .-> N66
  N132 -. type .-> N12
  N132 -. type .-> N96
  N134 --> N137
  N136 --> N133
  N136 --> N134
  N136 --> N135
  N139 --> N138
  N139 --> N140
  N139 --> N141
  N139 --> N142
  N139 --> N143
  N139 --> N144
  N139 --> N146
  N139 --> N147
  N139 --> N148
  N139 --> N149
  N139 --> N150
  N139 --> N151
  N139 --> N152
  N139 --> N153
  N139 --> N154
  N139 --> N155
  N139 --> N156
  N139 --> N157
  N140 --> N3
  N140 -. type .-> N61
  N140 --> N88
  N140 -. type .-> N101
  N140 --> N155
  N140 --> N156
  N140 -. type .-> N157
  N141 --> N3
  N141 -. type .-> N62
  N141 --> N88
  N141 -. type .-> N102
  N141 --> N155
  N141 -. type .-> N157
  N142 --> N3
  N142 -. type .-> N64
  N142 --> N88
  N142 -. type .-> N103
  N142 --> N155
  N142 -. type .-> N157
  N143 --> N3
  N143 -. type .-> N65
  N143 --> N88
  N143 -. type .-> N104
  N143 --> N155
  N143 -. type .-> N157
  N144 --> N3
  N144 --> N88
  N144 -. type .-> N93
  N144 -. type .-> N105
  N144 --> N155
  N144 -. type .-> N157
  N145 --> N11
  N145 --> N146
  N145 -. type .-> N157
  N146 --> N3
  N146 --> N94
  N146 -. type .-> N106
  N146 --> N124
  N146 --> N127
  N146 --> N137
  N146 --> N155
  N146 -. type .-> N157
  N147 --> N3
  N147 --> N88
  N147 -. type .-> N95
  N147 --> N155
  N147 -. type .-> N157
  N148 -. type .-> N3
  N148 --> N3
  N148 -. type .-> N4
  N148 -. type .-> N5
  N148 -. type .-> N6
  N148 --> N88
  N148 -. type .-> N92
  N148 -. type .-> N95
  N148 --> N95
  N148 -. type .-> N101
  N148 -. type .-> N107
  N148 -. type .-> N112
  N148 --> N137
  N148 --> N140
  N148 -. type .-> N147
  N148 -. type .-> N155
  N148 --> N155
  N148 -. type .-> N157
  N149 --> N3
  N149 -. type .-> N95
  N149 --> N95
  N149 -. type .-> N108
  N149 --> N155
  N149 -. type .-> N157
  N150 --> N3
  N150 --> N88
  N150 -. type .-> N100
  N150 -. type .-> N109
  N150 --> N155
  N150 -. type .-> N157
  N151 --> N3
  N151 -. type .-> N110
  N151 --> N115
  N151 --> N155
  N151 -. type .-> N157
  N152 --> N3
  N152 --> N88
```

## Part 3

```mermaid
flowchart LR
  N0["external:drizzle-orm"]
  N1["external:drizzle-orm/bun-sql"]
  N2["external:drizzle-orm/node-postgres"]
  N3["external:drizzle-orm/pg-core"]
  N4["external:drizzle-orm/pglite"]
  N5["packages/core/src/domain/errors/index.ts"]
  N6["packages/core/src/domain/interfaces/transaction-manager.ts"]
  N7["packages/core/src/domain/media/schemas.ts"]
  N8["packages/core/src/domain/repositories/job-repository.ts"]
  N9["packages/core/src/domain/repositories/source-repository.ts"]
  N10["packages/core/src/domain/repositories/tag-repository.ts"]
  N11["packages/core/src/domain/repositories/user-repository.ts"]
  N12["packages/core/src/domain/sources/schemas.ts"]
  N13["packages/core/src/domain/tags/schemas.ts"]
  N14["packages/core/src/utils/type-guards.ts"]
  N15["packages/db/src/repositories/source-repository.ts"]
  N16["packages/db/src/repositories/tag-repository.ts"]
  N17["packages/db/src/repositories/user-repository.ts"]
  N18["packages/db/src/schema.ts"]
  N19["packages/db/src/transaction-manager.ts"]
  N20["packages/db/src/types.ts"]
  N15 -. type .-> N9
  N15 --> N12
  N15 --> N14
  N15 --> N18
  N15 -. type .-> N20
  N16 --> N0
  N16 --> N5
  N16 -. type .-> N7
  N16 -. type .-> N10
  N16 -. type .-> N13
  N16 --> N18
  N16 -. type .-> N20
  N17 --> N0
  N17 --> N5
  N17 -. type .-> N11
  N17 --> N18
  N17 -. type .-> N20
  N18 -. type .-> N0
  N18 --> N0
  N18 --> N3
  N18 -. type .-> N8
  N19 -. type .-> N6
  N19 -. type .-> N20
  N20 -. type .-> N1
  N20 -. type .-> N2
  N20 -. type .-> N4
  N20 -. type .-> N18
```
