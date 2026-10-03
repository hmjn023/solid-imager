# solid-imager detail 01 - apps and core

## Diagram 1

```mermaid
graph LR
  N0["apps/cli/src/commands/ai.test.ts"]
  N1["node_modules/vitest/dist/index.js"]
  N2["apps/cli/src/orpc-client.ts"]
  N3["apps/cli/src/commands/ai.ts"]
  N4["node_modules/incur/dist/index.d.ts"]
  N5["apps/cli/src/utils.ts"]
  N6["apps/cli/src/commands/media.ts"]
  N7["apps/cli/src/commands/db.ts"]
  N8["npm:node:child_process"]
  N9["npm:node:fs"]
  N10["npm:node:path"]
  N11["apps/cli/src/commands/job.ts"]
  N12["apps/cli/src/commands/media.test.ts"]
  N13["npm:node:stream"]
  N14["npm:node:stream/promises"]
  N15["apps/cli/src/index.ts"]
  N16["apps/cli/node_modules/@solid-imager/client/src/index.ts"]
  N17["npm:@solid-imager/core/domain/contract"]
  N18["npm:@solid-imager/core/utils"]
  N19["apps/tauri/src/api/entities-api.ts"]
  N20["npm:~/orpc-client"]
  N21["apps/tauri/src/api/media-api.ts"]
  N22["apps/tauri/src/api/sources-api.ts"]
  N23["npm:@solid-imager/core/domain/sources/schemas"]
  N24["node_modules/zod/index.d.cts"]
  N25["apps/tauri/src/main.tsx"]
  N26["npm:@solid-imager/ui/layouts/app-shell"]
  N27["npm:@solid-imager/ui/router-status"]
  N28["apps/tauri/node_modules/@tanstack/solid-router/dist/cjs/index.cjs"]
  N29["node_modules/solid-js/types/index.d.ts"]
  N30["node_modules/solid-js/web/types/index.d.ts"]
  N31["apps/tauri/src/index.css"]
  N32["apps/tauri/src/collections/index.ts"]
  N33["apps/tauri/src/components/server-settings-screen.tsx"]
  N34["apps/tauri/src/collections/authors-collection.ts"]
  N35["node_modules/@tanstack/db/dist/cjs/index.cjs"]
  N36["node_modules/@tanstack/query-db-collection/dist/cjs/index.cjs"]
  N37["node_modules/@tanstack/tauri-db-sqlite-persistence/dist/cjs/index.cjs"]
  N38["npm:~/infrastructure/db/persistence"]
  N39["npm:~/query-client"]
  N40["apps/tauri/src/collections/query-keys.ts"]
  N41["apps/tauri/src/collections/characters-collection.ts"]
  N42["apps/tauri/src/collections/ips-collection.ts"]
  N43["apps/tauri/src/collections/projects-collection.ts"]
  N44["apps/tauri/src/collections/sources-collection.ts"]
  N45["apps/tauri/src/collections/tags-collection.ts"]
  N46["apps/tauri/src/components/imports/import-review-modal.tsx"]
  N47["npm:@solid-imager/ui/import-review-modal"]
  N48["apps/tauri/src/components/imports/pending-downloads-indicator.tsx"]
  N49["npm:@solid-imager/ui/event-stream"]
  N50["npm:@solid-imager/ui/pending-downloads-indicator"]
  N51["apps/tauri/src/components/media/ai-tagging-modal.tsx"]
  N52["npm:@solid-imager/ui/ai-tagging-modal"]
  N53["npm:~/infrastructure/api-clients/orpc-client"]
  N54["apps/tauri/src/components/media/character-crop-modal.tsx"]
  N55["npm:@solid-imager/core/domain/media/schemas"]
  N56["npm:@solid-imager/ui/character-crop-modal"]
  N57["apps/tauri/src/components/media/media-grid-item.tsx"]
  N58["apps/tauri/src/components/media/media-sidebar/media-sidebar-content.tsx"]
  N59["npm:@solid-imager/ui/media-sidebar-content"]
  N60["apps/tauri/src/components/media/media-viewer.tsx"]
  N61["apps/tauri/src/components/media/media-actions.tsx"]
  N62["npm:@solid-imager/ui/media-actions"]
  N63["npm:@solid-imager/ui/oppai-oracle-modal"]
  N64["npm:@solid-imager/ui/stores/search-store"]
  N65["npm:~/components/media/ai-tagging-modal"]
  N66["npm:~/components/media/character-crop-modal"]
  N67["npm:~/hooks/use-batch-job-events"]
  N68["npm:~/infrastructure/api-clients/media-api"]
  N69["npm:~/infrastructure/media/thumbnail-runtime"]
  N70["npm:~/infrastructure/tauri-fetch-helpers"]
  N71["apps/tauri/src/components/media/move-copy-media-dialog.tsx"]
  N72["npm:@solid-imager/ui/move-copy-media-dialog"]
  N73["npm:~/infrastructure/api-clients/sources-api"]
  N74["apps/tauri/src/components/media/thumbnail-image.tsx"]
  N75["apps/tauri/src/components/upload-media-modal/upload-media-modal-content.tsx"]
  N76["npm:@solid-imager/ui/upload-media-modal-content"]
  N77["npm:@solid-imager/ui/badge"]
  N78["npm:@solid-imager/ui/button"]
  N79["url:"]
  N80["apps/tauri/src/infrastructure/api-clients/ai-api.ts"]
  N81["apps/tauri/src/infrastructure/api-clients/characters-api.ts"]
  N82["apps/tauri/src/infrastructure/api-clients/imports-api.ts"]
  N83["apps/tauri/src/infrastructure/api-clients/ips-api.ts"]
  N84["apps/tauri/src/infrastructure/api-clients/projects-api.ts"]
  N85["apps/tauri/src/infrastructure/api-clients/search-api.ts"]
  N86["apps/tauri/src/infrastructure/api-clients/thumbnails-api.ts"]
  N87["apps/tauri/src/infrastructure/api/clients/preset-client.ts"]
  N88["npm:@solid-imager/core/domain/contract/presets-client"]
  N89["apps/tauri/src/infrastructure/api/clients/search-history-client.ts"]
  N90["npm:@solid-imager/core/domain/contract/search-snapshots-client"]
  N91["apps/tauri/src/infrastructure/db/persistence.ts"]
  N92["node_modules/@tauri-apps/plugin-sql/dist-js/index.cjs"]
  N93["npm:~/infrastructure/settings/server-settings"]
  N94["apps/tauri/src/infrastructure/media/thumbnail-runtime.ts"]
  N95["apps/tauri/src/infrastructure/tauri-fetch-helpers.ts"]
  N96["node_modules/@tauri-apps/plugin-http/dist-js/index.cjs"]
  N97["apps/tauri/src/infrastructure/api-base.ts"]
  N98["apps/tauri/src/infrastructure/settings/server-health.ts"]
  N99["apps/tauri/src/infrastructure/settings/server-settings.ts"]
  N100["node_modules/@tauri-apps/plugin-store/dist-js/index.cjs"]
  N101["npm:~/infrastructure/api-base"]
  N102["apps/tauri/src/orpc-client.ts"]
  N103["apps/tauri/node_modules/@solid-imager/client/src/index.ts"]
  N104["apps/tauri/src/queries/index.ts"]
  N105["node_modules/@orpc/solid-query/dist/index.d.mts"]
  N106["npm:@solid-imager/core/domain/jobs/schemas"]
  N107["apps/tauri/src/routes/$.tsx"]
  N108["npm:@solid-imager/ui/route-compat"]
  N109["npm:@solid-imager/ui/screens/not-found-screen"]
  N110["apps/tauri/src/routes/__root.tsx"]
  N111["npm:@solid-imager/ui/hooks/use-sources-page"]
  N112["npm:@solid-imager/ui/shortcuts/index"]
  N113["npm:@solid-imager/ui/toast"]
  N114["node_modules/@tanstack/solid-db/dist/esm/index.js"]
  N115["node_modules/@tanstack/solid-query/build/index.cjs"]
  N116["apps/tauri/src/routes/about.tsx"]
  N117["npm:@solid-imager/ui/screens/about-screen"]
  N118["apps/tauri/src/routes/config.tsx"]
  N119["npm:@solid-imager/ui/query-options"]
  N120["npm:@solid-imager/ui/query-state"]
  N121["npm:@solid-imager/ui/screens/config-state-screen"]
  N122["npm:~/queries"]
  N123["apps/tauri/src/routes/index.tsx"]
  N124["apps/tauri/src/routes/jobs.tsx"]
  N125["apps/tauri/src/routes/search.tsx"]
  N126["npm:@solid-imager/ui/bulk-action-dialog"]
  N127["apps/tauri/src/routes/sources/$mediaSourceId/$mediaId/index.tsx"]
  N128["npm:@solid-imager/ui/hooks/use-source-root-path"]
  N129["npm:@solid-imager/ui/media-detail-header"]
  N130["npm:@solid-imager/ui/screens/media-detail-screen"]
  N131["npm:~/components/media/media-actions"]
  N132["npm:~/components/media/media-sidebar"]
  N133["npm:~/components/media/media-viewer"]
  N134["npm:~/hooks/use-media-source-events"]
  N135["apps/tauri/src/routes/sources/$mediaSourceId/components/source-media-page.tsx"]
  N136["apps/tauri/src/routes/sources/$mediaSourceId/index.tsx"]
  N137["npm:@solid-imager/ui/search-history-route"]
  N138["apps/tauri/src/routes/sources/index.tsx"]
  N139["apps/tauri/src/routes/servers.tsx"]
  N140["npm:@solid-imager/ui/workspace/management-layout"]
  N141["npm:~/components/server-settings-screen"]
  N142["apps/tauri/src/routeTree.gen.ts"]
  N143["apps/tauri/src/routes/manager.tsx"]
  N144["apps/tauri/src/query-client.ts"]
  N145["apps/xtracter/src/api.ts"]
  N146["apps/xtracter/node_modules/@solid-imager/client/src/index.ts"]
  N147["apps/xtracter/src/background/index.ts"]
  N148["npm:@core/domain/media/utils/filename-utils"]
  N149["npm:@core/domain/sources/schemas"]
  N150["npm:@ext/api"]
  N151["apps/xtracter/src/content/danbooru.ts"]
  N152["npm:@ext/schema"]
  N153["apps/xtracter/src/utils/dom-utils.ts"]
  N154["apps/xtracter/src/content/index.ts"]
  N155["apps/xtracter/src/content/fanbox.ts"]
  N156["apps/xtracter/src/content/twitter.ts"]
  N157["apps/xtracter/src/content/twitter.test.ts"]
  N158["apps/xtracter/src/popup/index.html"]
  N159["url:en"]
  N160["url:UTF-8"]
  N161["url:viewport"]
  N162["url:width=device-width, initial-scale=1.0"]
  N163["url:root"]
  N164["url:module"]
  N165["url:index.tsx"]
  N166["apps/xtracter/src/popup/index.tsx"]
  N167["npm:@ext/utils/source-selection"]
  N168["apps/xtracter/src/schema.ts"]
  N169["apps/xtracter/src/utils/source-selection.test.ts"]
  N170["apps/xtracter/src/utils/source-selection.ts"]
  N171["packages/application/src/ports/media-service.ts"]
  N172["npm:@solid-imager/core/domain/interfaces/transaction-manager"]
  N173["packages/application/src/ports/media-processing-service.ts"]
  N174["packages/application/src/services/ip-service.ts"]
  N175["npm:@solid-imager/core/domain/ips/schemas"]
  N176["npm:@solid-imager/core/domain/repositories/ip-repository"]
  N177["packages/application/src/ports/ip-service.ts"]
  N178["packages/application/src/services/media-processing-service.ts"]
  N179["npm:@solid-imager/core/domain/characters/schemas"]
  N180["packages/application/src/services/media-query-service.ts"]
  N181["packages/application/node_modules/@solid-imager/core/src/index.ts"]
  N182["npm:@solid-imager/core/domain/errors"]
  N183["packages/application/src/services/media-service.ts"]
  N184["packages/application/src/services/media-transfer-service.ts"]
  N185["packages/application/src/services/media-upload-service.ts"]
  N186["packages/application/src/services/tagging-service.ts"]
  N187["npm:@solid-imager/core/domain/interfaces/ai-client"]
  N188["npm:@solid-imager/core/domain/repositories/character-repository"]
  N189["npm:@solid-imager/core/domain/repositories/media-repository"]
  N190["npm:@solid-imager/core/domain/repositories/source-repository"]
  N191["npm:@solid-imager/core/domain/repositories/tag-repository"]
  N192["npm:@solid-imager/core/domain/sources/events"]
  N193["npm:@solid-imager/core/domain/tagging/constants"]
  N194["packages/application/src/services/user-service.ts"]
  N195["npm:@solid-imager/core/domain/repositories/user-repository"]
  N196["packages/application/src/services/search-snapshot-service.ts"]
  N197["npm:node:crypto"]
  N198["npm:@solid-imager/core/domain/repositories/search-snapshot-repository"]
  N199["packages/application/src/utils/hash-utils.ts"]
  N200["packages/client/src/create-client.ts"]
  N201["node_modules/@orpc/client/dist/index.d.mts"]
  N202["npm:@orpc/client/fetch"]
  N203["node_modules/@orpc/contract/dist/index.d.mts"]
  N204["packages/client/src/api-error.ts"]
  N205["packages/client/src/api-error.test.ts"]
  N206["packages/client/src/create-client.test.ts"]
  N207["packages/core/src/domain/authors/schemas.ts"]
  N208["packages/core/src/domain/media/schemas.ts"]
  N209["packages/core/src/domain/categories/schemas.ts"]
  N210["packages/core/src/domain/characters/schemas.ts"]
  N211["packages/core/src/domain/collections/schemas.ts"]
  N212["packages/core/src/domain/config/config-schema.ts"]
  N213["packages/core/src/domain/contract/ai.contract.ts"]
  N214["packages/core/src/domain/contract/authors.contract.ts"]
  N215["packages/core/src/domain/contract/categories.contract.ts"]
  N216["packages/core/src/domain/contract/characters.contract.ts"]
  N217["packages/core/src/domain/contract/config.contract.ts"]
  N218["packages/core/src/domain/contract/directories.contract.ts"]
  N219["packages/core/src/domain/contract/downloads.contract.ts"]
  N220["packages/core/src/domain/contract/imports.contract.ts"]
  N221["packages/core/src/domain/contract/index.ts"]
  N222["packages/core/src/domain/contract/ips.contract.ts"]
  N223["packages/core/src/domain/contract/jobs.contract.ts"]
  N224["packages/core/src/domain/contract/media.contract.ts"]
  N225["packages/core/src/domain/contract/presets.contract.ts"]
  N226["packages/core/src/domain/contract/projects.contract.ts"]
  N227["packages/core/src/domain/contract/search-snapshots.contract.ts"]
  N228["packages/core/src/domain/contract/sources.contract.ts"]
  N229["packages/core/src/domain/contract/tags.contract.ts"]
  N230["packages/core/src/domain/contract/thumbnails.contract.ts"]
  N231["packages/core/src/domain/contract/utils.contract.ts"]
  N232["packages/core/src/domain/ips/schemas.ts"]
  N233["packages/core/src/domain/jobs/schemas.ts"]
  N234["packages/core/src/domain/sources/events.ts"]
  N235["packages/core/src/domain/contract/presets-client.ts"]
  N236["packages/core/src/domain/contract/search-snapshots-client.ts"]
  N237["packages/core/src/domain/events/media-source-events.ts"]
  N238["packages/core/src/domain/media/upload-schemas.ts"]
  N239["packages/core/src/domain/media/utils/filename-utils.ts"]
  N240["packages/core/src/domain/media/utils/metadata-utils.ts"]
  N241["npm:@/domain/media/schemas"]
  N242["packages/core/src/domain/projects/schemas.ts"]
  N243["packages/core/src/domain/repositories/author-repository.ts"]
  N244["npm:@/domain/interfaces/transaction-manager"]
  N245["packages/core/src/domain/repositories/authors-repository.ts"]
  N246["npm:@/domain/authors/schemas"]
  N247["packages/core/src/domain/repositories/category-repository.ts"]
  N248["npm:@/domain/categories/schemas"]
  N249["packages/core/src/domain/repositories/ip-repository.ts"]
  N250["npm:@/domain/ips/schemas"]
  N251["packages/core/src/domain/repositories/media-repository.ts"]
  N252["packages/core/src/domain/repositories/project-repository.ts"]
  N253["packages/core/src/domain/repositories/source-repository.ts"]
  N254["packages/core/src/domain/repositories/tag-repository.ts"]
  N255["npm:@/domain/tags/schemas"]
  N256["packages/core/src/domain/repositories/user-repository.ts"]
  N257["npm:@/domain/users/schemas"]
  N258["packages/core/src/domain/search/schema.ts"]
  N259["packages/core/src/domain/search/history.ts"]
  N260["packages/core/src/domain/services/storage-service.ts"]
  N261["npm:@/domain/media/upload-schemas"]
  N262["packages/core/src/domain/shared/schemas.ts"]
  N263["packages/core/src/domain/thumbnails/schemas.ts"]
  N264["packages/core/src/domain/sources/schemas.ts"]
  N265["packages/core/src/domain/sources/store.ts"]
  N266["node_modules/solid-js/store/types/index.d.ts"]
  N267["packages/core/src/domain/tagging/schemas.ts"]
  N268["packages/core/src/domain/tags/extractor.ts"]
  N269["packages/core/src/utils/type-guards.ts"]
  N270["packages/core/src/domain/tags/schemas.ts"]
  N271["packages/core/src/domain/users/schemas.ts"]
  N272["packages/core/src/interfaces/config-service.ts"]
  N273["npm:@/domain/config/config-schema"]
  N274["packages/core/src/interfaces/media-storage.ts"]
  N275["packages/core/src/utils/deep-equal.ts"]
  N276["packages/db/src/repositories/author-repository.ts"]
  N277["packages/db/src/repositories/authors-repository.ts"]
  N278["npm:@solid-imager/core/domain/authors/schemas"]
  N279["packages/db/src/repositories/job-repository.ts"]
  N280["packages/db/src/repositories/media-repository-utils.ts"]
  N281["packages/db/src/repositories/project-repository.ts"]
  N282["packages/db/src/repositories/job-repository.test.ts"]
  N283["packages/db/src/types.ts"]
  N284["packages/db/src/repositories/search-snapshot-repository.ts"]
  N285["packages/db/src/schema.ts"]
  N286["npm:@solid-imager/core/domain/repositories/job-repository"]
  N287["node_modules/drizzle-orm/index.d.ts"]
  N288["node_modules/drizzle-orm/bun-sql/index.d.ts"]
  N289["node_modules/drizzle-orm/node-postgres/index.d.ts"]
  N290["node_modules/drizzle-orm/pglite/index.d.ts"]
  N0 --> N1
  N0 --> N2
  N0 --> N3
  N3 --> N4
  N3 --> N2
  N3 --> N5
  N3 --> N6
  N7 --> N8
  N7 --> N9
  N7 --> N10
  N7 --> N4
  N7 --> N5
  N11 --> N4
  N11 --> N5
  N12 --> N9
  N12 --> N1
  N12 --> N2
  N6 --> N9
  N6 --> N10
  N6 --> N13
  N6 --> N14
  N6 --> N4
  N6 --> N2
  N6 --> N5
  N15 --> N4
  N15 --> N3
  N15 --> N7
  N15 --> N11
  N15 --> N6
  N15 --> N2
  N15 --> N5
  N2 --> N16
  N2 --> N17
  N5 --> N18
  N5 --> N4
  N19 --> N20
  N21 --> N20
  N22 --> N23
  N22 --> N24
  N22 --> N20
  N25 --> N26
  N25 --> N27
  N25 --> N28
  N25 --> N29
  N25 --> N30
  N25 --> N31
  N25 --> N32
  N25 --> N33
  N34 --> N35
  N34 --> N36
  N34 --> N37
  N34 --> N38
  N34 --> N20
  N34 --> N39
  N34 --> N40
  N41 --> N35
  N41 --> N36
  N41 --> N37
  N41 --> N38
  N41 --> N20
  N41 --> N39
  N41 --> N40
  N32 --> N38
  N32 --> N34
  N32 --> N41
  N32 --> N42
  N32 --> N43
  N32 --> N44
  N32 --> N45
  N42 --> N35
  N42 --> N36
  N42 --> N37
  N42 --> N38
  N42 --> N20
  N42 --> N39
  N42 --> N40
  N43 --> N35
  N43 --> N36
  N43 --> N37
  N43 --> N38
  N43 --> N20
  N43 --> N39
  N43 --> N40
  N44 --> N35
  N44 --> N36
  N44 --> N37
  N44 --> N38
  N44 --> N20
  N44 --> N39
  N44 --> N40
  N45 --> N35
  N45 --> N36
  N45 --> N37
  N45 --> N38
  N45 --> N20
  N45 --> N39
  N45 --> N40
  N46 --> N47
  N48 --> N49
  N48 --> N50
  N51 --> N52
  N51 --> N53
  N54 --> N55
  N54 --> N56
  N54 --> N53
  N57 --> N55
  N58 --> N55
  N58 --> N59
  N58 --> N29
  N60 --> N55
  N61 --> N55
  N61 --> N62
  N61 --> N63
  N61 --> N64
  N61 --> N28
  N61 --> N65
  N61 --> N66
  N61 --> N67
  N61 --> N68
  N61 --> N69
  N61 --> N70
  N61 --> N20
  N71 --> N23
  N71 --> N72
  N71 --> N29
  N71 --> N73
  N74 --> N55
  N75 --> N76
  N33 --> N77
  N33 --> N78
  N31 --> N79
  N80 --> N20
  N81 --> N20
  N82 --> N20
  N83 --> N20
  N84 --> N20
  N85 --> N55
  N85 --> N20
  N86 --> N53
  N87 --> N88
  N87 --> N20
  N89 --> N90
  N89 --> N20
  N91 --> N37
  N91 --> N92
  N91 --> N93
  N94 --> N70
  N95 --> N96
  N95 --> N97
  N98 --> N96
  N99 --> N100
  N99 --> N24
  N99 --> N101
  N102 --> N103
  N102 --> N17
  N102 --> N96
  N104 --> N105
  N104 --> N106
  N107 --> N108
  N107 --> N109
  N107 --> N28
  N107 --> N29
  N110 --> N23
  N110 --> N49
  N110 --> N111
  N110 --> N26
  N110 --> N27
  N110 --> N112
  N110 --> N113
  N110 --> N114
  N110 --> N115
  N116 --> N117
  N116 --> N28
  N116 --> N101
  N118 --> N119
  N118 --> N120
  N118 --> N121
  N118 --> N115
  N118 --> N28
  N118 --> N53
  N118 --> N122
  N123 --> N28
  N124 --> N103
  N125 --> N55
  N125 --> N18
  N125 --> N126
  N125 --> N78
  N127 --> N128
  N127 --> N129
  N127 --> N119
  N127 --> N27
  N127 --> N130
  N127 --> N115
  N127 --> N28
  N127 --> N29
  N127 --> N131
  N127 --> N132
  N127 --> N133
  N127 --> N134
  N127 --> N122
  N135 --> N55
  N135 --> N126
  N136 --> N137
  N136 --> N28
  N138 --> N28
  N139 --> N140
  N139 --> N28
  N139 --> N141
  N139 --> N93
  N142 --> N110
  N142 --> N123
  N142 --> N107
  N142 --> N116
  N142 --> N118
  N142 --> N124
  N142 --> N143
  N142 --> N125
  N142 --> N139
  N142 --> N138
  N142 --> N136
  N142 --> N127
  N144 --> N103
  N144 --> N119
  N144 --> N115
  N145 --> N146
  N145 --> N17
  N147 --> N148
  N147 --> N149
  N147 --> N150
  N151 --> N152
  N151 --> N153
  N154 --> N152
  N154 --> N151
  N154 --> N155
  N154 --> N156
  N156 --> N152
  N156 --> N153
  N155 --> N152
  N155 --> N153
  N157 --> N1
  N158 --> N159
  N158 --> N160
  N158 --> N161
  N158 --> N162
  N158 --> N163
  N158 --> N164
  N158 --> N165
  N166 --> N150
  N166 --> N152
  N166 --> N167
  N166 --> N29
  N166 --> N30
  N168 --> N24
  N169 --> N1
  N169 --> N170
  N171 --> N172
  N173 --> N172
  N174 --> N175
  N174 --> N176
  N174 --> N177
  N178 --> N10
  N178 --> N179
  N178 --> N172
  N180 --> N10
  N180 --> N181
  N180 --> N182
  N183 --> N172
  N184 --> N10
  N184 --> N181
  N184 --> N182
  N185 --> N10
  N185 --> N181
  N185 --> N182
  N186 --> N10
  N186 --> N187
  N186 --> N188
  N186 --> N176
  N186 --> N189
  N186 --> N190
  N186 --> N191
  N186 --> N192
  N186 --> N23
  N186 --> N193
  N194 --> N195
  N196 --> N197
  N196 --> N182
  N196 --> N198
  N199 --> N197
  N199 --> N9
  N199 --> N14
  N200 --> N201
  N200 --> N202
  N200 --> N203
  N200 --> N204
  N205 --> N1
  N205 --> N204
  N206 --> N1
  N206 --> N204
  N206 --> N200
  N207 --> N24
  N207 --> N208
  N209 --> N24
  N210 --> N24
  N211 --> N24
  N212 --> N24
  N213 --> N203
  N213 --> N24
  N214 --> N203
  N214 --> N207
  N215 --> N203
  N215 --> N24
  N215 --> N209
  N216 --> N203
  N216 --> N24
  N217 --> N203
  N217 --> N212
  N218 --> N203
  N218 --> N24
  N219 --> N203
  N219 --> N24
  N219 --> N208
  N220 --> N203
  N220 --> N24
  N221 --> N213
  N221 --> N214
  N221 --> N215
  N221 --> N216
  N221 --> N217
  N221 --> N218
  N221 --> N219
  N221 --> N220
  N221 --> N222
  N221 --> N223
  N221 --> N224
  N221 --> N225
  N221 --> N226
  N221 --> N227
  N221 --> N228
  N221 --> N229
  N221 --> N230
  N221 --> N231
  N222 --> N203
  N222 --> N24
  N222 --> N232
  N224 --> N203
  N224 --> N24
  N225 --> N203
  N225 --> N24
  N226 --> N203
  N226 --> N24
  N228 --> N203
  N228 --> N24
  N228 --> N233
  N228 --> N234
  N229 --> N203
  N229 --> N24
  N230 --> N203
  N230 --> N24
  N231 --> N203
  N231 --> N24
  N223 --> N203
  N223 --> N24
  N235 --> N203
  N235 --> N225
  N236 --> N203
  N236 --> N227
  N227 --> N203
  N237 --> N24
  N232 --> N24
  N208 --> N24
  N238 --> N24
  N239 --> N208
  N240 --> N241
  N242 --> N24
  N243 --> N244
  N243 --> N241
  N245 --> N246
  N247 --> N248
  N247 --> N244
  N249 --> N244
  N249 --> N250
  N251 --> N244
  N252 --> N244
  N253 --> N244
  N254 --> N244
  N254 --> N241
  N254 --> N255
  N256 --> N257
  N258 --> N24
  N258 --> N241
  N259 --> N24
  N259 --> N258
  N260 --> N24
  N260 --> N261
  N262 --> N24
  N234 --> N24
  N234 --> N263
  N234 --> N264
  N264 --> N24
  N265 --> N266
  N267 --> N24
  N268 --> N269
  N268 --> N270
  N270 --> N24
  N271 --> N24
  N233 --> N24
  N263 --> N24
  N272 --> N273
  N274 --> N24
  N274 --> N261
  N275 --> N269
  N276 --> N182
  N277 --> N278
  N279 --> N106
  N280 --> N182
  N280 --> N55
  N281 --> N182
  N282 --> N1
  N282 --> N283
  N282 --> N279
  N284 --> N198
  N285 --> N286
  N285 --> N287
  N283 --> N288
  N283 --> N289
  N283 --> N290
  N283 --> N285
```
