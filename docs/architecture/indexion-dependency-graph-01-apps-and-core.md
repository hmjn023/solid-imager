# solid-imager detail 01 - apps and core

```mermaid
graph LR
  N0[apps/cli/src/commands/ai.test.ts]
  N1[apps/cli/node_modules/vitest/dist/index.js]
  N2[apps/cli/src/orpc-client.ts]
  N3[apps/cli/src/commands/ai.ts]
  N4[apps/cli/node_modules/incur/dist/index.d.ts]
  N5[apps/cli/src/utils.ts]
  N6[apps/cli/src/commands/media.ts]
  N7[apps/cli/src/commands/db.ts]
  N8[npm:node:child_process]
  N9[npm:node:fs]
  N10[npm:node:path]
  N11[apps/cli/src/commands/job.ts]
  N12[apps/cli/src/commands/media.test.ts]
  N13[npm:node:stream]
  N14[npm:node:stream/promises]
  N15[apps/cli/src/index.ts]
  N16[apps/cli/node_modules/@solid-imager/client/src/index.ts]
  N17[npm:@solid-imager/core/utils]
  N18[apps/tauri/src/api/entities-api.ts]
  N19[npm:~/orpc-client]
  N20[apps/tauri/src/api/media-api.ts]
  N21[apps/tauri/src/api/sources-api.ts]
  N22[npm:@solid-imager/core/domain/sources/schemas]
  N23[apps/tauri/node_modules/zod/index.d.cts]
  N24[apps/tauri/src/main.tsx]
  N25[npm:@solid-imager/ui/layouts/app-shell]
  N26[npm:@solid-imager/ui/router-status]
  N27[apps/tauri/node_modules/@tanstack/solid-router/dist/cjs/index.cjs]
  N28[apps/tauri/node_modules/solid-js/types/index.d.ts]
  N29[apps/tauri/node_modules/solid-js/web/types/index.d.ts]
  N30[apps/tauri/src/index.css]
  N31[apps/tauri/src/collections/index.ts]
  N32[apps/tauri/src/router.tsx]
  N33[apps/tauri/src/collections/authors-collection.ts]
  N34[apps/tauri/node_modules/@tanstack/db/dist/cjs/index.cjs]
  N35[apps/tauri/node_modules/@tanstack/query-db-collection/dist/cjs/index.cjs]
  N36[apps/tauri/node_modules/@tanstack/tauri-db-sqlite-persistence/dist/cjs/index.cjs]
  N37[npm:~/infrastructure/db/persistence]
  N38[npm:~/router]
  N39[apps/tauri/src/collections/query-keys.ts]
  N40[apps/tauri/src/collections/characters-collection.ts]
  N41[apps/tauri/src/collections/ips-collection.ts]
  N42[apps/tauri/src/collections/projects-collection.ts]
  N43[apps/tauri/src/collections/sources-collection.ts]
  N44[apps/tauri/src/collections/tags-collection.ts]
  N45[apps/tauri/src/components/imports/import-review-modal.tsx]
  N46[npm:@solid-imager/ui/import-review-modal]
  N47[apps/tauri/src/components/imports/pending-downloads-indicator.tsx]
  N48[npm:@solid-imager/ui/event-stream]
  N49[npm:@solid-imager/ui/pending-downloads-indicator]
  N50[apps/tauri/src/components/media/ai-tagging-modal.tsx]
  N51[npm:@solid-imager/ui/ai-tagging-modal]
  N52[npm:~/infrastructure/api-clients/orpc-client]
  N53[apps/tauri/src/components/media/character-crop-modal.tsx]
  N54[npm:@solid-imager/core/domain/media/schemas]
  N55[npm:@solid-imager/ui/character-crop-modal]
  N56[apps/tauri/src/components/media/media-grid-item.tsx]
  N57[apps/tauri/src/components/media/media-sidebar/media-sidebar-content.tsx]
  N58[npm:@solid-imager/ui/media-sidebar-content]
  N59[npm:@solid-imager/ui/stores/search-store]
  N60[npm:~/hooks/use-batch-job-events]
  N61[apps/tauri/src/components/media/media-viewer.tsx]
  N62[apps/tauri/src/components/media/move-copy-media-dialog.tsx]
  N63[npm:@solid-imager/ui/move-copy-media-dialog]
  N64[npm:~/infrastructure/api-clients/sources-api]
  N65[apps/tauri/src/components/media/thumbnail-image.tsx]
  N66[apps/tauri/src/components/nav.tsx]
  N67[npm:@solid-imager/ui/layouts/app-nav]
  N68[apps/tauri/src/components/upload-media-modal/upload-media-modal-content.tsx]
  N69[npm:@solid-imager/ui/upload-media-modal-content]
  N70[url:]
  N71[apps/tauri/src/infrastructure/api-clients/ai-api.ts]
  N72[apps/tauri/src/infrastructure/api-clients/characters-api.ts]
  N73[apps/tauri/src/infrastructure/api-clients/imports-api.ts]
  N74[apps/tauri/src/infrastructure/api-clients/ips-api.ts]
  N75[apps/tauri/src/infrastructure/api-clients/projects-api.ts]
  N76[apps/tauri/src/infrastructure/api-clients/search-api.ts]
  N77[apps/tauri/src/infrastructure/api-clients/thumbnails-api.ts]
  N78[apps/tauri/src/infrastructure/api/clients/preset-client.ts]
  N79[npm:@solid-imager/core/domain/contract/presets-client]
  N80[apps/tauri/src/infrastructure/api/clients/search-history-client.ts]
  N81[npm:@solid-imager/core/domain/contract/search-snapshots-client]
  N82[apps/tauri/src/infrastructure/db/persistence.ts]
  N83[apps/tauri/node_modules/@tauri-apps/plugin-sql/dist-js/index.cjs]
  N84[apps/tauri/src/infrastructure/media/thumbnail-runtime.ts]
  N85[npm:~/infrastructure/tauri-fetch-helpers]
  N86[apps/tauri/src/infrastructure/tauri-fetch-helpers.ts]
  N87[apps/tauri/node_modules/@tauri-apps/plugin-http/dist-js/index.cjs]
  N88[apps/tauri/src/infrastructure/api-base.ts]
  N89[apps/tauri/src/orpc-client.ts]
  N90[apps/tauri/node_modules/@solid-imager/client/src/index.ts]
  N91[npm:@solid-imager/core/domain/contract]
  N92[apps/tauri/src/queries/index.ts]
  N93[apps/tauri/node_modules/@orpc/solid-query/dist/index.d.mts]
  N94[npm:@solid-imager/ui/query-options]
  N95[apps/tauri/src/routes/$.tsx]
  N96[npm:@solid-imager/ui/screens/not-found-screen]
  N97[apps/tauri/src/routes/__root.tsx]
  N98[npm:@solid-imager/ui/toast]
  N99[npm:~/components/nav]
  N100[apps/tauri/src/routes/about.tsx]
  N101[npm:@solid-imager/ui/badge]
  N102[apps/tauri/src/routes/config.tsx]
  N103[npm:@solid-imager/ui/query-state]
  N104[npm:@solid-imager/ui/screens/legacy-config-state-screen]
  N105[apps/tauri/node_modules/@tanstack/solid-query/build/index.cjs]
  N106[npm:~/queries]
  N107[apps/tauri/src/routes/index.tsx]
  N108[npm:@solid-imager/ui/button]
  N109[apps/tauri/src/routes/search.tsx]
  N110[npm:@solid-imager/ui/hooks/use-current-search-persistence]
  N111[npm:@solid-imager/ui/hooks/use-search-history-persistence]
  N112[npm:@solid-imager/ui/hooks/use-search-page]
  N113[npm:@solid-imager/ui/preset-client]
  N114[npm:@solid-imager/ui/screens/search-screen]
  N115[npm:@solid-imager/ui/search-history-client]
  N116[npm:@solid-imager/ui/search-history-route]
  N117[npm:~/components/media/media-grid-item]
  N118[npm:~/hooks/use-media-source-events]
  N119[npm:~/infrastructure/api/clients/preset-client]
  N120[npm:~/infrastructure/api/clients/search-history-client]
  N121[apps/tauri/src/routes/sources/$mediaSourceId/$mediaId/index.tsx]
  N122[npm:@solid-imager/ui/hooks/use-source-root-path]
  N123[npm:@solid-imager/ui/screens/legacy-media-detail-screen]
  N124[npm:~/components/media/media-sidebar]
  N125[npm:~/components/media/media-viewer]
  N126[apps/tauri/src/routes/sources/$mediaSourceId/components/source-media-page.tsx]
  N127[npm:@solid-imager/ui/screens/source-media-screen]
  N128[npm:@solid-imager/ui/source-media-page]
  N129[npm:~/components/media/move-copy-media-dialog]
  N130[npm:~/components/upload-media-modal]
  N131[apps/tauri/src/routes/sources/$mediaSourceId/index.tsx]
  N132[apps/tauri/src/routes/sources/index.tsx]
  N133[npm:@solid-imager/ui/hooks/use-sources-events]
  N134[npm:@solid-imager/ui/hooks/use-sources-page]
  N135[npm:@solid-imager/ui/legacy-source-form-modal]
  N136[npm:@solid-imager/ui/screens/sources-screen]
  N137[npm:@solid-imager/ui/source-card]
  N138[npm:@solid-imager/ui/source-delete-modal]
  N139[apps/tauri/node_modules/@tanstack/solid-db/dist/esm/index.js]
  N140[npm:~/collections]
  N141[npm:~/collections/query-keys]
  N142[apps/tauri/src/routes/v2/$.tsx]
  N143[apps/tauri/src/routes/jobs.tsx]
  N144[apps/tauri/src/routeTree.gen.ts]
  N145[apps/tauri/src/routes/manager.tsx]
  N146[apps/tauri/src/routes/v2.tsx]
  N147[apps/xtracter/src/api.ts]
  N148[apps/xtracter/node_modules/@solid-imager/client/src/index.ts]
  N149[apps/xtracter/src/background/index.ts]
  N150[npm:@core/domain/media/utils/filename-utils]
  N151[npm:@core/domain/sources/schemas]
  N152[npm:@ext/api]
  N153[apps/xtracter/src/content/danbooru.ts]
  N154[npm:@ext/schema]
  N155[apps/xtracter/src/utils/dom-utils.ts]
  N156[apps/xtracter/src/content/index.ts]
  N157[apps/xtracter/src/content/fanbox.ts]
  N158[apps/xtracter/src/content/twitter.ts]
  N159[apps/xtracter/src/content/twitter.test.ts]
  N160[node_modules/vitest/dist/index.js]
  N161[apps/xtracter/src/popup/index.html]
  N162[url:en]
  N163[url:UTF-8]
  N164[url:viewport]
  N165[url:width=device-width, initial-scale=1.0]
  N166[url:root]
  N167[url:module]
  N168[url:index.tsx]
  N169[apps/xtracter/src/popup/index.tsx]
  N170[apps/xtracter/node_modules/solid-js/types/index.d.ts]
  N171[apps/xtracter/node_modules/solid-js/web/types/index.d.ts]
  N172[apps/xtracter/src/schema.ts]
  N173[apps/xtracter/node_modules/zod/index.d.cts]
  N174[packages/application/src/ports/media-service.ts]
  N175[npm:@solid-imager/core/domain/interfaces/transaction-manager]
  N176[packages/application/src/ports/media-processing-service.ts]
  N177[packages/application/src/ports/search-service.ts]
  N178[packages/application/src/services/ip-service.ts]
  N179[npm:@solid-imager/core/domain/ips/schemas]
  N180[npm:@solid-imager/core/domain/repositories/ip-repository]
  N181[packages/application/src/ports/ip-service.ts]
  N182[packages/application/src/services/media-processing-service.ts]
  N183[npm:@solid-imager/core/domain/characters/schemas]
  N184[packages/application/src/services/media-query-service.ts]
  N185[packages/application/node_modules/@solid-imager/core/src/index.ts]
  N186[npm:@solid-imager/core/domain/errors]
  N187[packages/application/src/services/media-service.ts]
  N188[packages/application/src/services/media-transfer-service.ts]
  N189[packages/application/src/services/media-upload-service.ts]
  N190[packages/application/src/services/tagging-service.ts]
  N191[npm:@solid-imager/core/domain/interfaces/ai-client]
  N192[npm:@solid-imager/core/domain/repositories/character-repository]
  N193[npm:@solid-imager/core/domain/repositories/media-repository]
  N194[npm:@solid-imager/core/domain/repositories/source-repository]
  N195[npm:@solid-imager/core/domain/repositories/tag-repository]
  N196[npm:@solid-imager/core/domain/sources/events]
  N197[npm:@solid-imager/core/domain/tagging/constants]
  N198[packages/application/src/services/user-service.ts]
  N199[npm:@solid-imager/core/domain/repositories/user-repository]
  N200[packages/application/src/services/search-snapshot-service.ts]
  N201[npm:node:crypto]
  N202[npm:@solid-imager/core/domain/repositories/search-snapshot-repository]
  N203[packages/application/src/utils/hash-utils.ts]
  N204[packages/client/src/create-client.ts]
  N205[packages/client/node_modules/@orpc/client/dist/index.d.mts]
  N206[npm:@orpc/client/fetch]
  N207[packages/client/node_modules/@orpc/contract/dist/index.d.mts]
  N208[packages/client/src/api-error.ts]
  N209[packages/client/src/api-error.test.ts]
  N210[packages/client/node_modules/vitest/dist/index.js]
  N211[packages/client/src/create-client.test.ts]
  N212[packages/core/src/domain/authors/schemas.ts]
  N213[packages/core/node_modules/zod/index.d.cts]
  N214[packages/core/src/domain/media/schemas.ts]
  N215[packages/core/src/domain/categories/schemas.ts]
  N216[packages/core/src/domain/characters/schemas.ts]
  N217[packages/core/src/domain/collections/schemas.ts]
  N218[packages/core/src/domain/config/config-schema.ts]
  N219[packages/core/src/domain/contract/ai.contract.ts]
  N220[packages/core/node_modules/@orpc/contract/dist/index.d.mts]
  N221[packages/core/src/domain/contract/authors.contract.ts]
  N222[packages/core/src/domain/contract/categories.contract.ts]
  N223[packages/core/src/domain/contract/characters.contract.ts]
  N224[packages/core/src/domain/contract/config.contract.ts]
  N225[packages/core/src/domain/contract/directories.contract.ts]
  N226[packages/core/src/domain/contract/downloads.contract.ts]
  N227[packages/core/src/domain/contract/imports.contract.ts]
  N228[packages/core/src/domain/contract/index.ts]
  N229[packages/core/src/domain/contract/ips.contract.ts]
  N230[packages/core/src/domain/contract/jobs.contract.ts]
  N231[packages/core/src/domain/contract/media.contract.ts]
  N232[packages/core/src/domain/contract/presets.contract.ts]
  N233[packages/core/src/domain/contract/projects.contract.ts]
  N234[packages/core/src/domain/contract/search-snapshots.contract.ts]
  N235[packages/core/src/domain/contract/sources.contract.ts]
  N236[packages/core/src/domain/contract/tags.contract.ts]
  N237[packages/core/src/domain/contract/thumbnails.contract.ts]
  N238[packages/core/src/domain/contract/utils.contract.ts]
  N239[packages/core/src/domain/ips/schemas.ts]
  N240[packages/core/src/domain/jobs/schemas.ts]
  N241[packages/core/src/domain/sources/events.ts]
  N242[packages/core/src/domain/contract/presets-client.ts]
  N243[packages/core/src/domain/contract/search-snapshots-client.ts]
  N244[packages/core/src/domain/events/media-source-events.ts]
  N245[packages/core/src/domain/media/upload-schemas.ts]
  N246[packages/core/src/domain/media/utils/filename-utils.ts]
  N247[packages/core/src/domain/media/utils/metadata-utils.ts]
  N248[npm:@/domain/media/schemas]
  N249[packages/core/src/domain/projects/schemas.ts]
  N250[packages/core/src/domain/repositories/author-repository.ts]
  N251[npm:@/domain/interfaces/transaction-manager]
  N252[packages/core/src/domain/repositories/authors-repository.ts]
  N253[npm:@/domain/authors/schemas]
  N254[packages/core/src/domain/repositories/category-repository.ts]
  N255[npm:@/domain/categories/schemas]
  N256[packages/core/src/domain/repositories/ip-repository.ts]
  N257[npm:@/domain/ips/schemas]
  N258[packages/core/src/domain/repositories/media-repository.ts]
  N259[packages/core/src/domain/repositories/project-repository.ts]
  N260[packages/core/src/domain/repositories/source-repository.ts]
  N261[packages/core/src/domain/repositories/tag-repository.ts]
  N262[npm:@/domain/tags/schemas]
  N263[packages/core/src/domain/repositories/user-repository.ts]
  N264[npm:@/domain/users/schemas]
  N265[packages/core/src/domain/search/schema.ts]
  N266[packages/core/src/domain/search/history.ts]
  N267[packages/core/src/domain/services/storage-service.ts]
  N268[npm:@/domain/media/upload-schemas]
  N269[packages/core/src/domain/shared/schemas.ts]
  N270[packages/core/src/domain/thumbnails/schemas.ts]
  N271[packages/core/src/domain/sources/schemas.ts]
  N272[packages/core/src/domain/sources/store.ts]
  N273[packages/core/node_modules/solid-js/store/types/index.d.ts]
  N274[packages/core/src/domain/tagging/schemas.ts]
  N275[packages/core/src/domain/tags/extractor.ts]
  N276[packages/core/src/utils/type-guards.ts]
  N277[packages/core/src/domain/tags/schemas.ts]
  N278[packages/core/src/domain/users/schemas.ts]
  N279[packages/core/src/interfaces/config-service.ts]
  N280[npm:@/domain/config/config-schema]
  N281[packages/core/src/interfaces/media-storage.ts]
  N282[packages/core/src/utils/deep-equal.ts]
  N283[packages/db/src/repositories/author-repository.ts]
  N284[packages/db/src/repositories/authors-repository.ts]
  N285[npm:@solid-imager/core/domain/authors/schemas]
  N286[packages/db/src/repositories/job-repository.ts]
  N287[npm:@solid-imager/core/domain/jobs/schemas]
  N288[packages/db/src/repositories/media-repository-utils.ts]
  N289[packages/db/src/repositories/project-repository.ts]
  N290[packages/db/src/repositories/job-repository.test.ts]
  N291[packages/db/node_modules/vitest/dist/index.js]
  N292[packages/db/src/types.ts]
  N293[packages/db/src/repositories/search-snapshot-repository.ts]
  N294[packages/db/src/schema.ts]
  N295[npm:@solid-imager/core/domain/repositories/job-repository]
  N296[packages/db/node_modules/drizzle-orm/index.d.ts]
  N297[packages/db/node_modules/drizzle-orm/node-postgres/index.d.ts]
  N298[packages/db/node_modules/drizzle-orm/pglite/index.d.ts]
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
  N5 --> N17
  N5 --> N4
  N18 --> N19
  N20 --> N19
  N21 --> N22
  N21 --> N23
  N21 --> N19
  N24 --> N25
  N24 --> N26
  N24 --> N27
  N24 --> N28
  N24 --> N29
  N24 --> N30
  N24 --> N31
  N24 --> N32
  N33 --> N34
  N33 --> N35
  N33 --> N36
  N33 --> N37
  N33 --> N19
  N33 --> N38
  N33 --> N39
  N40 --> N34
  N40 --> N35
  N40 --> N36
  N40 --> N37
  N40 --> N19
  N40 --> N38
  N40 --> N39
  N31 --> N37
  N31 --> N33
  N31 --> N40
  N31 --> N41
  N31 --> N42
  N31 --> N43
  N31 --> N44
  N41 --> N34
  N41 --> N35
  N41 --> N36
  N41 --> N37
  N41 --> N19
  N41 --> N38
  N41 --> N39
  N42 --> N34
  N42 --> N35
  N42 --> N36
  N42 --> N37
  N42 --> N19
  N42 --> N38
  N42 --> N39
  N43 --> N34
  N43 --> N35
  N43 --> N36
  N43 --> N37
  N43 --> N19
  N43 --> N38
  N43 --> N39
  N44 --> N34
  N44 --> N35
  N44 --> N36
  N44 --> N37
  N44 --> N19
  N44 --> N38
  N44 --> N39
  N45 --> N46
  N47 --> N48
  N47 --> N49
  N50 --> N51
  N50 --> N52
  N53 --> N54
  N53 --> N55
  N53 --> N52
  N56 --> N54
  N57 --> N54
  N57 --> N58
  N57 --> N59
  N57 --> N27
  N57 --> N60
  N61 --> N54
  N62 --> N22
  N62 --> N63
  N62 --> N28
  N62 --> N64
  N65 --> N54
  N66 --> N67
  N66 --> N47
  N68 --> N69
  N30 --> N70
  N71 --> N19
  N72 --> N19
  N73 --> N19
  N74 --> N19
  N75 --> N19
  N76 --> N54
  N76 --> N19
  N77 --> N52
  N78 --> N79
  N78 --> N19
  N80 --> N81
  N80 --> N19
  N82 --> N36
  N82 --> N83
  N84 --> N85
  N86 --> N87
  N86 --> N88
  N89 --> N90
  N89 --> N91
  N89 --> N87
  N92 --> N93
  N32 --> N90
  N32 --> N94
  N95 --> N96
  N95 --> N27
  N97 --> N25
  N97 --> N26
  N97 --> N98
  N97 --> N27
  N97 --> N99
  N97 --> N38
  N100 --> N101
  N102 --> N94
  N102 --> N103
  N102 --> N104
  N102 --> N105
  N102 --> N27
  N102 --> N52
  N102 --> N106
  N107 --> N101
  N107 --> N108
  N109 --> N108
  N109 --> N110
  N109 --> N111
  N109 --> N112
  N109 --> N113
  N109 --> N114
  N109 --> N115
  N109 --> N116
  N109 --> N27
  N109 --> N117
  N109 --> N118
  N109 --> N119
  N109 --> N120
  N121 --> N122
  N121 --> N94
  N121 --> N26
  N121 --> N123
  N121 --> N105
  N121 --> N27
  N121 --> N124
  N121 --> N125
  N121 --> N118
  N121 --> N106
  N126 --> N122
  N126 --> N113
  N126 --> N127
  N126 --> N115
  N126 --> N128
  N126 --> N27
  N126 --> N117
  N126 --> N129
  N126 --> N130
  N126 --> N118
  N126 --> N119
  N126 --> N120
  N131 --> N116
  N131 --> N27
  N132 --> N22
  N132 --> N48
  N132 --> N133
  N132 --> N134
  N132 --> N135
  N132 --> N103
  N132 --> N136
  N132 --> N137
  N132 --> N138
  N132 --> N139
  N132 --> N105
  N132 --> N27
  N132 --> N140
  N132 --> N141
  N132 --> N52
  N142 --> N96
  N142 --> N27
  N142 --> N28
  N143 --> N90
  N144 --> N97
  N144 --> N107
  N144 --> N95
  N144 --> N100
  N144 --> N102
  N144 --> N143
  N144 --> N145
  N144 --> N109
  N144 --> N146
  N144 --> N132
  N144 --> N142
  N144 --> N131
  N144 --> N121
  N147 --> N148
  N147 --> N91
  N149 --> N150
  N149 --> N151
  N149 --> N152
  N153 --> N154
  N153 --> N155
  N156 --> N154
  N156 --> N153
  N156 --> N157
  N156 --> N158
  N158 --> N154
  N158 --> N155
  N157 --> N154
  N157 --> N155
  N159 --> N160
  N159 --> N158
  N161 --> N162
  N161 --> N163
  N161 --> N164
  N161 --> N165
  N161 --> N166
  N161 --> N167
  N161 --> N168
  N169 --> N152
  N169 --> N154
  N169 --> N170
  N169 --> N171
  N172 --> N173
  N174 --> N175
  N176 --> N175
  N177 --> N54
  N178 --> N179
  N178 --> N180
  N178 --> N181
  N182 --> N10
  N182 --> N183
  N182 --> N175
  N184 --> N10
  N184 --> N185
  N184 --> N186
  N187 --> N175
  N188 --> N10
  N188 --> N185
  N188 --> N186
  N189 --> N10
  N189 --> N185
  N189 --> N186
  N190 --> N10
  N190 --> N191
  N190 --> N192
  N190 --> N180
  N190 --> N193
  N190 --> N194
  N190 --> N195
  N190 --> N196
  N190 --> N22
  N190 --> N197
  N198 --> N199
  N200 --> N201
  N200 --> N186
  N200 --> N202
  N203 --> N201
  N203 --> N9
  N203 --> N14
  N204 --> N205
  N204 --> N206
  N204 --> N207
  N204 --> N208
  N209 --> N210
  N209 --> N208
  N211 --> N210
  N211 --> N208
  N211 --> N204
  N212 --> N213
  N212 --> N214
  N215 --> N213
  N216 --> N213
  N217 --> N213
  N218 --> N213
  N219 --> N220
  N219 --> N213
  N221 --> N220
  N221 --> N212
  N222 --> N220
  N222 --> N213
  N222 --> N215
  N223 --> N220
  N223 --> N213
  N224 --> N220
  N224 --> N218
  N225 --> N220
  N225 --> N213
  N226 --> N220
  N226 --> N213
  N226 --> N214
  N227 --> N220
  N227 --> N213
  N228 --> N219
  N228 --> N221
  N228 --> N222
  N228 --> N223
  N228 --> N224
  N228 --> N225
  N228 --> N226
  N228 --> N227
  N228 --> N229
  N228 --> N230
  N228 --> N231
  N228 --> N232
  N228 --> N233
  N228 --> N234
  N228 --> N235
  N228 --> N236
  N228 --> N237
  N228 --> N238
  N229 --> N220
  N229 --> N213
  N229 --> N239
  N231 --> N220
  N231 --> N213
  N232 --> N220
  N232 --> N213
  N233 --> N220
  N233 --> N213
  N235 --> N220
  N235 --> N213
  N235 --> N240
  N235 --> N241
  N236 --> N220
  N236 --> N213
  N237 --> N220
  N237 --> N213
  N238 --> N220
  N238 --> N213
  N230 --> N220
  N230 --> N213
  N242 --> N220
  N242 --> N232
  N234 --> N220
  N243 --> N220
  N243 --> N234
  N244 --> N213
  N239 --> N213
  N214 --> N213
  N245 --> N213
  N246 --> N214
  N247 --> N248
  N249 --> N213
  N250 --> N251
  N250 --> N248
  N252 --> N253
  N254 --> N255
  N254 --> N251
  N256 --> N251
  N256 --> N257
  N258 --> N251
  N259 --> N251
  N260 --> N251
  N261 --> N251
  N261 --> N248
  N261 --> N262
  N263 --> N264
  N265 --> N213
  N265 --> N248
  N266 --> N213
  N266 --> N265
  N267 --> N213
  N267 --> N268
  N269 --> N213
  N241 --> N213
  N241 --> N270
  N241 --> N271
  N271 --> N213
  N272 --> N273
  N274 --> N213
  N275 --> N276
  N275 --> N277
  N277 --> N213
  N278 --> N213
  N240 --> N213
  N270 --> N213
  N279 --> N280
  N281 --> N213
  N281 --> N268
  N282 --> N276
  N283 --> N201
  N283 --> N186
  N284 --> N285
  N286 --> N287
  N288 --> N186
  N289 --> N186
  N290 --> N291
  N290 --> N292
  N290 --> N286
  N293 --> N202
  N294 --> N295
  N294 --> N296
  N292 --> N297
  N292 --> N298
  N292 --> N294
```
