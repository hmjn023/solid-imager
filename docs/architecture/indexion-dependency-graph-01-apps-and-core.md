# solid-imager detail 01 - apps and core

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
  N39["npm:~/router"]
  N40["apps/tauri/src/collections/query-keys.ts"]
  N41["apps/tauri/src/collections/characters-collection.ts"]
  N42["apps/tauri/src/collections/ips-collection.ts"]
  N43["apps/tauri/src/collections/projects-collection.ts"]
  N44["apps/tauri/src/collections/sources-collection.ts"]
  N45["apps/tauri/src/collections/tags-collection.ts"]
  N46["apps/tauri/src/components/imports/import-review-modal.tsx"]
  N47["npm:@solid-imager/ui/tauri-import-review-modal"]
  N48["apps/tauri/src/components/imports/pending-downloads-indicator.tsx"]
  N49["npm:@solid-imager/ui/event-stream"]
  N50["npm:@solid-imager/ui/tauri-pending-downloads-indicator"]
  N51["apps/tauri/src/components/media/ai-tagging-modal.tsx"]
  N52["npm:@solid-imager/ui/ai-tagging-modal"]
  N53["npm:~/infrastructure/api-clients/orpc-client"]
  N54["apps/tauri/src/components/media/character-crop-modal.tsx"]
  N55["npm:@solid-imager/core/domain/media/schemas"]
  N56["npm:@solid-imager/ui/character-crop-modal"]
  N57["apps/tauri/src/components/media/media-grid-item.tsx"]
  N58["apps/tauri/src/components/media/media-sidebar/media-sidebar-content.tsx"]
  N59["npm:@solid-imager/ui/media-sidebar-content"]
  N60["npm:@solid-imager/ui/stores/search-store"]
  N61["npm:~/hooks/use-batch-job-events"]
  N62["apps/tauri/src/components/media/media-viewer.tsx"]
  N63["apps/tauri/src/components/media/move-copy-media-dialog.tsx"]
  N64["npm:@solid-imager/ui/move-copy-media-dialog"]
  N65["npm:~/infrastructure/api-clients/sources-api"]
  N66["apps/tauri/src/components/media/thumbnail-image.tsx"]
  N67["apps/tauri/src/components/nav.tsx"]
  N68["npm:@solid-imager/ui/layouts/app-nav"]
  N69["apps/tauri/src/components/upload-media-modal/upload-media-modal-content.tsx"]
  N70["npm:@solid-imager/ui/upload-media-modal-content"]
  N71["npm:@solid-imager/ui/badge"]
  N72["npm:@solid-imager/ui/button"]
  N73["url:"]
  N74["apps/tauri/src/infrastructure/api-clients/ai-api.ts"]
  N75["apps/tauri/src/infrastructure/api-clients/characters-api.ts"]
  N76["apps/tauri/src/infrastructure/api-clients/imports-api.ts"]
  N77["apps/tauri/src/infrastructure/api-clients/ips-api.ts"]
  N78["apps/tauri/src/infrastructure/api-clients/projects-api.ts"]
  N79["apps/tauri/src/infrastructure/api-clients/search-api.ts"]
  N80["apps/tauri/src/infrastructure/api-clients/thumbnails-api.ts"]
  N81["apps/tauri/src/infrastructure/api/clients/preset-client.ts"]
  N82["npm:@solid-imager/core/domain/contract/presets-client"]
  N83["apps/tauri/src/infrastructure/api/clients/search-history-client.ts"]
  N84["npm:@solid-imager/core/domain/contract/search-snapshots-client"]
  N85["apps/tauri/src/infrastructure/db/persistence.ts"]
  N86["node_modules/@tauri-apps/plugin-sql/dist-js/index.cjs"]
  N87["npm:~/infrastructure/settings/server-settings"]
  N88["apps/tauri/src/infrastructure/media/thumbnail-runtime.ts"]
  N89["npm:~/infrastructure/tauri-fetch-helpers"]
  N90["apps/tauri/src/infrastructure/tauri-fetch-helpers.ts"]
  N91["node_modules/@tauri-apps/plugin-http/dist-js/index.cjs"]
  N92["apps/tauri/src/infrastructure/api-base.ts"]
  N93["apps/tauri/src/infrastructure/settings/server-health.ts"]
  N94["apps/tauri/src/infrastructure/settings/server-settings.ts"]
  N95["node_modules/@tauri-apps/plugin-store/dist-js/index.cjs"]
  N96["npm:~/infrastructure/api-base"]
  N97["apps/tauri/src/orpc-client.ts"]
  N98["apps/tauri/node_modules/@solid-imager/client/src/index.ts"]
  N99["apps/tauri/src/queries/index.ts"]
  N100["node_modules/@orpc/solid-query/dist/index.d.mts"]
  N101["npm:@solid-imager/core/domain/jobs/schemas"]
  N102["apps/tauri/src/router.tsx"]
  N103["npm:@solid-imager/ui/query-options"]
  N104["apps/tauri/src/routes/$.tsx"]
  N105["npm:@solid-imager/ui/route-compat"]
  N106["npm:@solid-imager/ui/screens/not-found-screen"]
  N107["apps/tauri/src/routes/__root.tsx"]
  N108["npm:@solid-imager/ui/shortcuts/index"]
  N109["npm:@solid-imager/ui/toast"]
  N110["npm:~/components/nav"]
  N111["apps/tauri/src/routes/about.tsx"]
  N112["apps/tauri/src/routes/config.tsx"]
  N113["npm:@solid-imager/ui/query-state"]
  N114["npm:@solid-imager/ui/screens/tauri-config-state-screen"]
  N115["node_modules/@tanstack/solid-query/build/index.cjs"]
  N116["npm:~/queries"]
  N117["apps/tauri/src/routes/index.tsx"]
  N118["apps/tauri/src/routes/jobs.tsx"]
  N119["apps/tauri/src/routes/search.tsx"]
  N120["npm:@solid-imager/ui/hooks/use-current-search-persistence"]
  N121["npm:@solid-imager/ui/hooks/use-search-history-persistence"]
  N122["npm:@solid-imager/ui/hooks/use-search-page"]
  N123["npm:@solid-imager/ui/preset-client"]
  N124["npm:@solid-imager/ui/screens/tauri-search-screen"]
  N125["npm:@solid-imager/ui/search-history-client"]
  N126["npm:@solid-imager/ui/search-history-route"]
  N127["npm:~/components/media/media-grid-item"]
  N128["npm:~/hooks/use-media-source-events"]
  N129["npm:~/infrastructure/api/clients/preset-client"]
  N130["npm:~/infrastructure/api/clients/search-history-client"]
  N131["apps/tauri/src/routes/sources/$mediaSourceId/$mediaId/index.tsx"]
  N132["npm:@solid-imager/ui/hooks/use-source-root-path"]
  N133["npm:@solid-imager/ui/screens/tauri-media-detail-screen"]
  N134["npm:~/components/media/media-sidebar"]
  N135["npm:~/components/media/media-viewer"]
  N136["apps/tauri/src/routes/sources/$mediaSourceId/components/source-media-page.tsx"]
  N137["npm:@solid-imager/ui/screens/tauri-source-media-screen"]
  N138["npm:@solid-imager/ui/source-media-page"]
  N139["npm:~/components/media/move-copy-media-dialog"]
  N140["npm:~/components/upload-media-modal"]
  N141["apps/tauri/src/routes/sources/$mediaSourceId/index.tsx"]
  N142["apps/tauri/src/routes/sources/index.tsx"]
  N143["npm:@solid-imager/ui/hooks/use-sources-events"]
  N144["npm:@solid-imager/ui/hooks/use-sources-page"]
  N145["npm:@solid-imager/ui/screens/sources-screen"]
  N146["npm:@solid-imager/ui/source-card"]
  N147["npm:@solid-imager/ui/source-delete-modal"]
  N148["npm:@solid-imager/ui/tauri-source-form-modal"]
  N149["node_modules/@tanstack/solid-db/dist/esm/index.js"]
  N150["npm:~/collections"]
  N151["npm:~/collections/query-keys"]
  N152["apps/tauri/src/routes/servers.tsx"]
  N153["npm:~/components/server-settings-screen"]
  N154["apps/tauri/src/routeTree.gen.ts"]
  N155["apps/tauri/src/routes/manager.tsx"]
  N156["apps/xtracter/src/api.ts"]
  N157["apps/xtracter/node_modules/@solid-imager/client/src/index.ts"]
  N158["apps/xtracter/src/background/index.ts"]
  N159["npm:@core/domain/media/utils/filename-utils"]
  N160["npm:@core/domain/sources/schemas"]
  N161["npm:@ext/api"]
  N162["apps/xtracter/src/content/danbooru.ts"]
  N163["npm:@ext/schema"]
  N164["apps/xtracter/src/utils/dom-utils.ts"]
  N165["apps/xtracter/src/content/index.ts"]
  N166["apps/xtracter/src/content/fanbox.ts"]
  N167["apps/xtracter/src/content/twitter.ts"]
  N168["apps/xtracter/src/content/twitter.test.ts"]
  N169["apps/xtracter/src/popup/index.html"]
  N170["url:en"]
  N171["url:UTF-8"]
  N172["url:viewport"]
  N173["url:width=device-width, initial-scale=1.0"]
  N174["url:root"]
  N175["url:module"]
  N176["url:index.tsx"]
  N177["apps/xtracter/src/popup/index.tsx"]
  N178["npm:@ext/utils/source-selection"]
  N179["apps/xtracter/src/schema.ts"]
  N180["apps/xtracter/src/utils/source-selection.test.ts"]
  N181["apps/xtracter/src/utils/source-selection.ts"]
  N182["packages/application/src/ports/media-service.ts"]
  N183["npm:@solid-imager/core/domain/interfaces/transaction-manager"]
  N184["packages/application/src/ports/media-processing-service.ts"]
  N185["packages/application/src/services/ip-service.ts"]
  N186["npm:@solid-imager/core/domain/ips/schemas"]
  N187["npm:@solid-imager/core/domain/repositories/ip-repository"]
  N188["packages/application/src/ports/ip-service.ts"]
  N189["packages/application/src/services/media-processing-service.ts"]
  N190["npm:@solid-imager/core/domain/characters/schemas"]
  N191["packages/application/src/services/media-query-service.ts"]
  N192["packages/application/node_modules/@solid-imager/core/src/index.ts"]
  N193["npm:@solid-imager/core/domain/errors"]
  N194["packages/application/src/services/media-service.ts"]
  N195["packages/application/src/services/media-transfer-service.ts"]
  N196["packages/application/src/services/media-upload-service.ts"]
  N197["packages/application/src/services/tagging-service.ts"]
  N198["npm:@solid-imager/core/domain/interfaces/ai-client"]
  N199["npm:@solid-imager/core/domain/repositories/character-repository"]
  N200["npm:@solid-imager/core/domain/repositories/media-repository"]
  N201["npm:@solid-imager/core/domain/repositories/source-repository"]
  N202["npm:@solid-imager/core/domain/repositories/tag-repository"]
  N203["npm:@solid-imager/core/domain/sources/events"]
  N204["npm:@solid-imager/core/domain/tagging/constants"]
  N205["packages/application/src/services/user-service.ts"]
  N206["npm:@solid-imager/core/domain/repositories/user-repository"]
  N207["packages/application/src/services/search-snapshot-service.ts"]
  N208["npm:node:crypto"]
  N209["npm:@solid-imager/core/domain/repositories/search-snapshot-repository"]
  N210["packages/application/src/utils/hash-utils.ts"]
  N211["packages/client/src/create-client.ts"]
  N212["node_modules/@orpc/client/dist/index.d.mts"]
  N213["npm:@orpc/client/fetch"]
  N214["node_modules/@orpc/contract/dist/index.d.mts"]
  N215["packages/client/src/api-error.ts"]
  N216["packages/client/src/api-error.test.ts"]
  N217["packages/client/src/create-client.test.ts"]
  N218["packages/core/src/domain/authors/schemas.ts"]
  N219["packages/core/src/domain/media/schemas.ts"]
  N220["packages/core/src/domain/categories/schemas.ts"]
  N221["packages/core/src/domain/characters/schemas.ts"]
  N222["packages/core/src/domain/collections/schemas.ts"]
  N223["packages/core/src/domain/config/config-schema.ts"]
  N224["packages/core/src/domain/contract/ai.contract.ts"]
  N225["packages/core/src/domain/contract/authors.contract.ts"]
  N226["packages/core/src/domain/contract/categories.contract.ts"]
  N227["packages/core/src/domain/contract/characters.contract.ts"]
  N228["packages/core/src/domain/contract/config.contract.ts"]
  N229["packages/core/src/domain/contract/directories.contract.ts"]
  N230["packages/core/src/domain/contract/downloads.contract.ts"]
  N231["packages/core/src/domain/contract/imports.contract.ts"]
  N232["packages/core/src/domain/contract/index.ts"]
  N233["packages/core/src/domain/contract/ips.contract.ts"]
  N234["packages/core/src/domain/contract/jobs.contract.ts"]
  N235["packages/core/src/domain/contract/media.contract.ts"]
  N236["packages/core/src/domain/contract/presets.contract.ts"]
  N237["packages/core/src/domain/contract/projects.contract.ts"]
  N238["packages/core/src/domain/contract/search-snapshots.contract.ts"]
  N239["packages/core/src/domain/contract/sources.contract.ts"]
  N240["packages/core/src/domain/contract/tags.contract.ts"]
  N241["packages/core/src/domain/contract/thumbnails.contract.ts"]
  N242["packages/core/src/domain/contract/utils.contract.ts"]
  N243["packages/core/src/domain/ips/schemas.ts"]
  N244["packages/core/src/domain/jobs/schemas.ts"]
  N245["packages/core/src/domain/sources/events.ts"]
  N246["packages/core/src/domain/contract/presets-client.ts"]
  N247["packages/core/src/domain/contract/search-snapshots-client.ts"]
  N248["packages/core/src/domain/events/media-source-events.ts"]
  N249["packages/core/src/domain/media/upload-schemas.ts"]
  N250["packages/core/src/domain/media/utils/filename-utils.ts"]
  N251["packages/core/src/domain/media/utils/metadata-utils.ts"]
  N252["npm:@/domain/media/schemas"]
  N253["packages/core/src/domain/projects/schemas.ts"]
  N254["packages/core/src/domain/repositories/author-repository.ts"]
  N255["npm:@/domain/interfaces/transaction-manager"]
  N256["packages/core/src/domain/repositories/authors-repository.ts"]
  N257["npm:@/domain/authors/schemas"]
  N258["packages/core/src/domain/repositories/category-repository.ts"]
  N259["npm:@/domain/categories/schemas"]
  N260["packages/core/src/domain/repositories/ip-repository.ts"]
  N261["npm:@/domain/ips/schemas"]
  N262["packages/core/src/domain/repositories/media-repository.ts"]
  N263["packages/core/src/domain/repositories/project-repository.ts"]
  N264["packages/core/src/domain/repositories/source-repository.ts"]
  N265["packages/core/src/domain/repositories/tag-repository.ts"]
  N266["npm:@/domain/tags/schemas"]
  N267["packages/core/src/domain/repositories/user-repository.ts"]
  N268["npm:@/domain/users/schemas"]
  N269["packages/core/src/domain/search/schema.ts"]
  N270["packages/core/src/domain/search/history.ts"]
  N271["packages/core/src/domain/services/storage-service.ts"]
  N272["npm:@/domain/media/upload-schemas"]
  N273["packages/core/src/domain/shared/schemas.ts"]
  N274["packages/core/src/domain/thumbnails/schemas.ts"]
  N275["packages/core/src/domain/sources/schemas.ts"]
  N276["packages/core/src/domain/sources/store.ts"]
  N277["node_modules/solid-js/store/types/index.d.ts"]
  N278["packages/core/src/domain/tagging/schemas.ts"]
  N279["packages/core/src/domain/tags/extractor.ts"]
  N280["packages/core/src/utils/type-guards.ts"]
  N281["packages/core/src/domain/tags/schemas.ts"]
  N282["packages/core/src/domain/users/schemas.ts"]
  N283["packages/core/src/interfaces/config-service.ts"]
  N284["npm:@/domain/config/config-schema"]
  N285["packages/core/src/interfaces/media-storage.ts"]
  N286["packages/core/src/utils/deep-equal.ts"]
  N287["packages/db/src/repositories/author-repository.ts"]
  N288["packages/db/src/repositories/authors-repository.ts"]
  N289["npm:@solid-imager/core/domain/authors/schemas"]
  N290["packages/db/src/repositories/job-repository.ts"]
  N291["packages/db/src/repositories/media-repository-utils.ts"]
  N292["packages/db/src/repositories/project-repository.ts"]
  N293["packages/db/src/repositories/job-repository.test.ts"]
  N294["packages/db/src/types.ts"]
  N295["packages/db/src/repositories/search-snapshot-repository.ts"]
  N296["packages/db/src/schema.ts"]
  N297["npm:@solid-imager/core/domain/repositories/job-repository"]
  N298["node_modules/drizzle-orm/index.d.ts"]
  N299["node_modules/drizzle-orm/bun-sql/index.d.ts"]
  N300["node_modules/drizzle-orm/node-postgres/index.d.ts"]
  N301["node_modules/drizzle-orm/pglite/index.d.ts"]
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
  N58 --> N60
  N58 --> N28
  N58 --> N29
  N58 --> N61
  N62 --> N55
  N63 --> N23
  N63 --> N64
  N63 --> N29
  N63 --> N65
  N66 --> N55
  N67 --> N68
  N67 --> N48
  N69 --> N70
  N33 --> N71
  N33 --> N72
  N31 --> N73
  N74 --> N20
  N75 --> N20
  N76 --> N20
  N77 --> N20
  N78 --> N20
  N79 --> N55
  N79 --> N20
  N80 --> N53
  N81 --> N82
  N81 --> N20
  N83 --> N84
  N83 --> N20
  N85 --> N37
  N85 --> N86
  N85 --> N87
  N88 --> N89
  N90 --> N91
  N90 --> N92
  N93 --> N91
  N94 --> N95
  N94 --> N24
  N94 --> N96
  N97 --> N98
  N97 --> N17
  N97 --> N91
  N99 --> N100
  N99 --> N101
  N102 --> N98
  N102 --> N103
  N104 --> N105
  N104 --> N106
  N104 --> N28
  N104 --> N29
  N107 --> N26
  N107 --> N27
  N107 --> N108
  N107 --> N109
  N107 --> N28
  N107 --> N110
  N107 --> N39
  N111 --> N71
  N112 --> N103
  N112 --> N113
  N112 --> N114
  N112 --> N115
  N112 --> N28
  N112 --> N53
  N112 --> N116
  N117 --> N71
  N117 --> N72
  N118 --> N98
  N119 --> N72
  N119 --> N120
  N119 --> N121
  N119 --> N122
  N119 --> N123
  N119 --> N124
  N119 --> N125
  N119 --> N126
  N119 --> N60
  N119 --> N28
  N119 --> N127
  N119 --> N128
  N119 --> N129
  N119 --> N130
  N131 --> N132
  N131 --> N103
  N131 --> N27
  N131 --> N133
  N131 --> N115
  N131 --> N28
  N131 --> N134
  N131 --> N135
  N131 --> N128
  N131 --> N116
  N136 --> N132
  N136 --> N123
  N136 --> N137
  N136 --> N125
  N136 --> N138
  N136 --> N60
  N136 --> N28
  N136 --> N127
  N136 --> N139
  N136 --> N140
  N136 --> N128
  N136 --> N129
  N136 --> N130
  N141 --> N126
  N141 --> N28
  N142 --> N23
  N142 --> N49
  N142 --> N143
  N142 --> N144
  N142 --> N113
  N142 --> N145
  N142 --> N146
  N142 --> N147
  N142 --> N148
  N142 --> N149
  N142 --> N115
  N142 --> N28
  N142 --> N150
  N142 --> N151
  N142 --> N53
  N152 --> N28
  N152 --> N153
  N152 --> N87
  N154 --> N107
  N154 --> N117
  N154 --> N104
  N154 --> N111
  N154 --> N112
  N154 --> N118
  N154 --> N155
  N154 --> N119
  N154 --> N152
  N154 --> N142
  N154 --> N141
  N154 --> N131
  N156 --> N157
  N156 --> N17
  N158 --> N159
  N158 --> N160
  N158 --> N161
  N162 --> N163
  N162 --> N164
  N165 --> N163
  N165 --> N162
  N165 --> N166
  N165 --> N167
  N167 --> N163
  N167 --> N164
  N166 --> N163
  N166 --> N164
  N168 --> N1
  N169 --> N170
  N169 --> N171
  N169 --> N172
  N169 --> N173
  N169 --> N174
  N169 --> N175
  N169 --> N176
  N177 --> N161
  N177 --> N163
  N177 --> N178
  N177 --> N29
  N177 --> N30
  N179 --> N24
  N180 --> N1
  N180 --> N181
  N182 --> N183
  N184 --> N183
  N185 --> N186
  N185 --> N187
  N185 --> N188
  N189 --> N10
  N189 --> N190
  N189 --> N183
  N191 --> N10
  N191 --> N192
  N191 --> N193
  N194 --> N183
  N195 --> N10
  N195 --> N192
  N195 --> N193
  N196 --> N10
  N196 --> N192
  N196 --> N193
  N197 --> N10
  N197 --> N198
  N197 --> N199
  N197 --> N187
  N197 --> N200
  N197 --> N201
  N197 --> N202
  N197 --> N203
  N197 --> N23
  N197 --> N204
  N205 --> N206
  N207 --> N208
  N207 --> N193
  N207 --> N209
  N210 --> N208
  N210 --> N9
  N210 --> N14
  N211 --> N212
  N211 --> N213
  N211 --> N214
  N211 --> N215
  N216 --> N1
  N216 --> N215
  N217 --> N1
  N217 --> N215
  N217 --> N211
  N218 --> N24
  N218 --> N219
  N220 --> N24
  N221 --> N24
  N222 --> N24
  N223 --> N24
  N224 --> N214
  N224 --> N24
  N225 --> N214
  N225 --> N218
  N226 --> N214
  N226 --> N24
  N226 --> N220
  N227 --> N214
  N227 --> N24
  N228 --> N214
  N228 --> N223
  N229 --> N214
  N229 --> N24
  N230 --> N214
  N230 --> N24
  N230 --> N219
  N231 --> N214
  N231 --> N24
  N232 --> N224
  N232 --> N225
  N232 --> N226
  N232 --> N227
  N232 --> N228
  N232 --> N229
  N232 --> N230
  N232 --> N231
  N232 --> N233
  N232 --> N234
  N232 --> N235
  N232 --> N236
  N232 --> N237
  N232 --> N238
  N232 --> N239
  N232 --> N240
  N232 --> N241
  N232 --> N242
  N233 --> N214
  N233 --> N24
  N233 --> N243
  N235 --> N214
  N235 --> N24
  N236 --> N214
  N236 --> N24
  N237 --> N214
  N237 --> N24
  N239 --> N214
  N239 --> N24
  N239 --> N244
  N239 --> N245
  N240 --> N214
  N240 --> N24
  N241 --> N214
  N241 --> N24
  N242 --> N214
  N242 --> N24
  N234 --> N214
  N234 --> N24
  N246 --> N214
  N246 --> N236
  N247 --> N214
  N247 --> N238
  N238 --> N214
  N248 --> N24
  N243 --> N24
  N219 --> N24
  N249 --> N24
  N250 --> N219
  N251 --> N252
  N253 --> N24
  N254 --> N255
  N254 --> N252
  N256 --> N257
  N258 --> N259
  N258 --> N255
  N260 --> N255
  N260 --> N261
  N262 --> N255
  N263 --> N255
  N264 --> N255
  N265 --> N255
  N265 --> N252
  N265 --> N266
  N267 --> N268
  N269 --> N24
  N269 --> N252
  N270 --> N24
  N270 --> N269
  N271 --> N24
  N271 --> N272
  N273 --> N24
  N245 --> N24
  N245 --> N274
  N245 --> N275
  N275 --> N24
  N276 --> N277
  N278 --> N24
  N279 --> N280
  N279 --> N281
  N281 --> N24
  N282 --> N24
  N244 --> N24
  N274 --> N24
  N283 --> N284
  N285 --> N24
  N285 --> N272
  N286 --> N280
  N287 --> N193
  N288 --> N289
  N290 --> N101
  N291 --> N193
  N291 --> N55
  N292 --> N193
  N293 --> N1
  N293 --> N294
  N293 --> N290
  N295 --> N209
  N296 --> N297
  N296 --> N298
  N294 --> N299
  N294 --> N300
  N294 --> N301
  N294 --> N296
```
