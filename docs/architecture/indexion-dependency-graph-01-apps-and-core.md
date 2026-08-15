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
  N80[apps/tauri/src/infrastructure/db/persistence.ts]
  N81[apps/tauri/node_modules/@tauri-apps/plugin-sql/dist-js/index.cjs]
  N82[apps/tauri/src/infrastructure/media/thumbnail-runtime.ts]
  N83[npm:~/infrastructure/tauri-fetch-helpers]
  N84[apps/tauri/src/infrastructure/tauri-fetch-helpers.ts]
  N85[apps/tauri/node_modules/@tauri-apps/plugin-http/dist-js/index.cjs]
  N86[apps/tauri/src/infrastructure/api-base.ts]
  N87[apps/tauri/src/orpc-client.ts]
  N88[apps/tauri/node_modules/@solid-imager/client/src/index.ts]
  N89[npm:@solid-imager/core/domain/contract]
  N90[apps/tauri/src/queries/index.ts]
  N91[apps/tauri/node_modules/@orpc/solid-query/dist/index.d.mts]
  N92[npm:@solid-imager/ui/query-options]
  N93[apps/tauri/src/routes/$.tsx]
  N94[npm:@solid-imager/ui/screens/not-found-screen]
  N95[apps/tauri/src/routes/__root.tsx]
  N96[npm:@solid-imager/ui/toast]
  N97[npm:~/components/nav]
  N98[apps/tauri/src/routes/about.tsx]
  N99[npm:@solid-imager/ui/badge]
  N100[apps/tauri/src/routes/config.tsx]
  N101[npm:@solid-imager/ui/query-state]
  N102[npm:@solid-imager/ui/screens/legacy-config-state-screen]
  N103[apps/tauri/node_modules/@tanstack/solid-query/build/index.cjs]
  N104[npm:~/queries]
  N105[apps/tauri/src/routes/index.tsx]
  N106[npm:@solid-imager/ui/button]
  N107[apps/tauri/src/routes/search.tsx]
  N108[npm:@solid-imager/ui/hooks/use-current-search-persistence]
  N109[npm:@solid-imager/ui/hooks/use-search-page]
  N110[npm:@solid-imager/ui/preset-client]
  N111[npm:@solid-imager/ui/screens/search-screen]
  N112[npm:~/components/media/media-grid-item]
  N113[npm:~/hooks/use-current-search-persistence]
  N114[npm:~/hooks/use-media-source-events]
  N115[npm:~/infrastructure/api/clients/preset-client]
  N116[apps/tauri/src/routes/sources/$mediaSourceId/$mediaId/index.tsx]
  N117[npm:@solid-imager/ui/hooks/use-source-root-path]
  N118[npm:@solid-imager/ui/screens/legacy-media-detail-screen]
  N119[npm:~/components/media/media-sidebar]
  N120[npm:~/components/media/media-viewer]
  N121[apps/tauri/src/routes/sources/$mediaSourceId/components/source-media-page.tsx]
  N122[npm:@solid-imager/ui/screens/source-media-screen]
  N123[npm:@solid-imager/ui/source-media-page]
  N124[npm:~/components/media/move-copy-media-dialog]
  N125[npm:~/components/upload-media-modal]
  N126[apps/tauri/src/routes/sources/$mediaSourceId/index.tsx]
  N127[apps/tauri/src/routes/sources/index.tsx]
  N128[npm:@solid-imager/ui/hooks/use-sources-events]
  N129[npm:@solid-imager/ui/hooks/use-sources-page]
  N130[npm:@solid-imager/ui/legacy-source-form-modal]
  N131[npm:@solid-imager/ui/screens/sources-screen]
  N132[npm:@solid-imager/ui/source-card]
  N133[npm:@solid-imager/ui/source-delete-modal]
  N134[apps/tauri/node_modules/@tanstack/solid-db/dist/esm/index.js]
  N135[npm:~/collections]
  N136[npm:~/collections/query-keys]
  N137[apps/tauri/src/routes/v2/$.tsx]
  N138[apps/tauri/src/routeTree.gen.ts]
  N139[apps/tauri/src/routes/manager.tsx]
  N140[apps/tauri/src/routes/v2.tsx]
  N141[apps/xtracter/src/api.ts]
  N142[apps/xtracter/node_modules/@solid-imager/client/src/index.ts]
  N143[apps/xtracter/src/background/index.ts]
  N144[npm:@core/domain/media/utils/filename-utils]
  N145[npm:@core/domain/sources/schemas]
  N146[npm:@ext/api]
  N147[apps/xtracter/src/content/danbooru.ts]
  N148[npm:@ext/schema]
  N149[apps/xtracter/src/utils/dom-utils.ts]
  N150[apps/xtracter/src/content/index.ts]
  N151[apps/xtracter/src/content/fanbox.ts]
  N152[apps/xtracter/src/content/twitter.ts]
  N153[apps/xtracter/src/content/twitter.test.ts]
  N154[node_modules/vitest/dist/index.js]
  N155[apps/xtracter/src/popup/index.html]
  N156[url:en]
  N157[url:UTF-8]
  N158[url:viewport]
  N159[url:width=device-width, initial-scale=1.0]
  N160[url:root]
  N161[url:module]
  N162[url:index.tsx]
  N163[apps/xtracter/src/popup/index.tsx]
  N164[apps/xtracter/node_modules/solid-js/types/index.d.ts]
  N165[apps/xtracter/node_modules/solid-js/web/types/index.d.ts]
  N166[apps/xtracter/src/schema.ts]
  N167[apps/xtracter/node_modules/zod/index.d.cts]
  N168[packages/application/src/ports/media-service.ts]
  N169[npm:@solid-imager/core/domain/interfaces/transaction-manager]
  N170[packages/application/src/ports/media-processing-service.ts]
  N171[packages/application/src/ports/search-service.ts]
  N172[packages/application/src/services/ip-service.ts]
  N173[npm:@solid-imager/core/domain/ips/schemas]
  N174[npm:@solid-imager/core/domain/repositories/ip-repository]
  N175[packages/application/src/ports/ip-service.ts]
  N176[packages/application/src/services/media-processing-service.ts]
  N177[npm:@solid-imager/core/domain/characters/schemas]
  N178[packages/application/src/services/media-query-service.ts]
  N179[packages/application/node_modules/@solid-imager/core/src/index.ts]
  N180[npm:@solid-imager/core/domain/errors]
  N181[packages/application/src/services/media-service.ts]
  N182[packages/application/src/services/media-transfer-service.ts]
  N183[packages/application/src/services/media-upload-service.ts]
  N184[packages/application/src/services/tagging-service.ts]
  N185[npm:@solid-imager/core/domain/interfaces/ai-client]
  N186[npm:@solid-imager/core/domain/repositories/character-repository]
  N187[npm:@solid-imager/core/domain/repositories/media-repository]
  N188[npm:@solid-imager/core/domain/repositories/source-repository]
  N189[npm:@solid-imager/core/domain/repositories/tag-repository]
  N190[npm:@solid-imager/core/domain/sources/events]
  N191[npm:@solid-imager/core/domain/tagging/constants]
  N192[packages/application/src/services/user-service.ts]
  N193[npm:@solid-imager/core/domain/repositories/user-repository]
  N194[packages/application/src/utils/hash-utils.ts]
  N195[npm:node:crypto]
  N196[packages/client/src/create-client.ts]
  N197[packages/client/node_modules/@orpc/client/dist/index.d.mts]
  N198[npm:@orpc/client/fetch]
  N199[packages/client/node_modules/@orpc/contract/dist/index.d.mts]
  N200[packages/client/src/api-error.ts]
  N201[packages/client/src/api-error.test.ts]
  N202[packages/client/node_modules/vitest/dist/index.js]
  N203[packages/client/src/create-client.test.ts]
  N204[packages/core/src/domain/authors/schemas.ts]
  N205[packages/core/node_modules/zod/index.d.cts]
  N206[packages/core/src/domain/media/schemas.ts]
  N207[packages/core/src/domain/categories/schemas.ts]
  N208[packages/core/src/domain/characters/schemas.ts]
  N209[packages/core/src/domain/collections/schemas.ts]
  N210[packages/core/src/domain/config/config-schema.ts]
  N211[packages/core/src/domain/contract/ai.contract.ts]
  N212[packages/core/node_modules/@orpc/contract/dist/index.d.mts]
  N213[packages/core/src/domain/contract/authors.contract.ts]
  N214[packages/core/src/domain/contract/categories.contract.ts]
  N215[packages/core/src/domain/contract/characters.contract.ts]
  N216[packages/core/src/domain/contract/config.contract.ts]
  N217[packages/core/src/domain/contract/directories.contract.ts]
  N218[packages/core/src/domain/contract/downloads.contract.ts]
  N219[packages/core/src/domain/contract/imports.contract.ts]
  N220[packages/core/src/domain/contract/index.ts]
  N221[packages/core/src/domain/contract/ips.contract.ts]
  N222[packages/core/src/domain/contract/jobs.contract.ts]
  N223[packages/core/src/domain/contract/media.contract.ts]
  N224[packages/core/src/domain/contract/presets.contract.ts]
  N225[packages/core/src/domain/contract/projects.contract.ts]
  N226[packages/core/src/domain/contract/sources.contract.ts]
  N227[packages/core/src/domain/contract/tags.contract.ts]
  N228[packages/core/src/domain/contract/thumbnails.contract.ts]
  N229[packages/core/src/domain/contract/utils.contract.ts]
  N230[packages/core/src/domain/ips/schemas.ts]
  N231[packages/core/src/domain/jobs/schemas.ts]
  N232[packages/core/src/domain/sources/events.ts]
  N233[packages/core/src/domain/contract/presets-client.ts]
  N234[packages/core/src/domain/events/media-source-events.ts]
  N235[packages/core/src/domain/media/upload-schemas.ts]
  N236[packages/core/src/domain/media/utils/filename-utils.ts]
  N237[packages/core/src/domain/media/utils/metadata-utils.ts]
  N238[npm:@/domain/media/schemas]
  N239[packages/core/src/domain/projects/schemas.ts]
  N240[packages/core/src/domain/repositories/author-repository.ts]
  N241[npm:@/domain/interfaces/transaction-manager]
  N242[packages/core/src/domain/repositories/authors-repository.ts]
  N243[npm:@/domain/authors/schemas]
  N244[packages/core/src/domain/repositories/category-repository.ts]
  N245[npm:@/domain/categories/schemas]
  N246[packages/core/src/domain/repositories/ip-repository.ts]
  N247[npm:@/domain/ips/schemas]
  N248[packages/core/src/domain/repositories/media-repository.ts]
  N249[packages/core/src/domain/repositories/project-repository.ts]
  N250[packages/core/src/domain/repositories/source-repository.ts]
  N251[packages/core/src/domain/repositories/tag-repository.ts]
  N252[npm:@/domain/tags/schemas]
  N253[packages/core/src/domain/repositories/user-repository.ts]
  N254[npm:@/domain/users/schemas]
  N255[packages/core/src/domain/search/schema.ts]
  N256[packages/core/src/domain/services/storage-service.ts]
  N257[npm:@/domain/media/upload-schemas]
  N258[packages/core/src/domain/shared/schemas.ts]
  N259[packages/core/src/domain/thumbnails/schemas.ts]
  N260[packages/core/src/domain/sources/schemas.ts]
  N261[packages/core/src/domain/sources/store.ts]
  N262[packages/core/node_modules/solid-js/store/types/index.d.ts]
  N263[packages/core/src/domain/tagging/schemas.ts]
  N264[packages/core/src/domain/tags/extractor.ts]
  N265[packages/core/src/utils/type-guards.ts]
  N266[packages/core/src/domain/tags/schemas.ts]
  N267[packages/core/src/domain/users/schemas.ts]
  N268[packages/core/src/interfaces/config-service.ts]
  N269[npm:@/domain/config/config-schema]
  N270[packages/core/src/interfaces/media-storage.ts]
  N271[packages/core/src/utils/deep-equal.ts]
  N272[packages/db/src/repositories/author-repository.ts]
  N273[packages/db/src/repositories/authors-repository.ts]
  N274[npm:@solid-imager/core/domain/authors/schemas]
  N275[packages/db/src/repositories/job-repository.ts]
  N276[npm:@solid-imager/core/domain/jobs/schemas]
  N277[packages/db/src/repositories/media-repository-utils.ts]
  N278[packages/db/src/repositories/project-repository.ts]
  N279[packages/db/src/repositories/job-repository.test.ts]
  N280[packages/db/node_modules/vitest/dist/index.js]
  N281[packages/db/src/types.ts]
  N282[packages/db/src/schema.ts]
  N283[npm:@solid-imager/core/domain/repositories/job-repository]
  N284[packages/db/node_modules/drizzle-orm/index.d.ts]
  N285[packages/db/node_modules/drizzle-orm/node-postgres/index.d.ts]
  N286[packages/db/node_modules/drizzle-orm/pglite/index.d.ts]
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
  N80 --> N36
  N80 --> N81
  N82 --> N83
  N84 --> N85
  N84 --> N86
  N87 --> N88
  N87 --> N89
  N87 --> N85
  N90 --> N91
  N32 --> N88
  N32 --> N92
  N93 --> N94
  N93 --> N27
  N95 --> N25
  N95 --> N26
  N95 --> N96
  N95 --> N27
  N95 --> N97
  N95 --> N38
  N98 --> N99
  N100 --> N92
  N100 --> N101
  N100 --> N102
  N100 --> N103
  N100 --> N27
  N100 --> N52
  N100 --> N104
  N105 --> N99
  N105 --> N106
  N107 --> N106
  N107 --> N108
  N107 --> N109
  N107 --> N110
  N107 --> N111
  N107 --> N27
  N107 --> N112
  N107 --> N113
  N107 --> N114
  N107 --> N115
  N116 --> N117
  N116 --> N92
  N116 --> N26
  N116 --> N118
  N116 --> N103
  N116 --> N27
  N116 --> N119
  N116 --> N120
  N116 --> N114
  N116 --> N104
  N121 --> N117
  N121 --> N110
  N121 --> N122
  N121 --> N123
  N121 --> N27
  N121 --> N112
  N121 --> N124
  N121 --> N125
  N121 --> N114
  N121 --> N115
  N126 --> N27
  N127 --> N22
  N127 --> N48
  N127 --> N128
  N127 --> N129
  N127 --> N130
  N127 --> N101
  N127 --> N131
  N127 --> N132
  N127 --> N133
  N127 --> N134
  N127 --> N103
  N127 --> N27
  N127 --> N135
  N127 --> N136
  N127 --> N52
  N137 --> N94
  N137 --> N27
  N137 --> N28
  N138 --> N95
  N138 --> N105
  N138 --> N93
  N138 --> N98
  N138 --> N100
  N138 --> N139
  N138 --> N107
  N138 --> N140
  N138 --> N127
  N138 --> N137
  N138 --> N126
  N138 --> N116
  N141 --> N142
  N141 --> N89
  N143 --> N144
  N143 --> N145
  N143 --> N146
  N147 --> N148
  N147 --> N149
  N150 --> N148
  N150 --> N147
  N150 --> N151
  N150 --> N152
  N152 --> N148
  N152 --> N149
  N151 --> N148
  N151 --> N149
  N153 --> N154
  N153 --> N152
  N155 --> N156
  N155 --> N157
  N155 --> N158
  N155 --> N159
  N155 --> N160
  N155 --> N161
  N155 --> N162
  N163 --> N146
  N163 --> N148
  N163 --> N164
  N163 --> N165
  N166 --> N167
  N168 --> N169
  N170 --> N169
  N171 --> N54
  N172 --> N173
  N172 --> N174
  N172 --> N175
  N176 --> N10
  N176 --> N177
  N176 --> N169
  N178 --> N10
  N178 --> N179
  N178 --> N180
  N181 --> N169
  N182 --> N10
  N182 --> N179
  N182 --> N180
  N183 --> N10
  N183 --> N179
  N183 --> N180
  N184 --> N10
  N184 --> N185
  N184 --> N186
  N184 --> N174
  N184 --> N187
  N184 --> N188
  N184 --> N189
  N184 --> N190
  N184 --> N22
  N184 --> N191
  N192 --> N193
  N194 --> N195
  N194 --> N9
  N194 --> N14
  N196 --> N197
  N196 --> N198
  N196 --> N199
  N196 --> N200
  N201 --> N202
  N201 --> N200
  N203 --> N202
  N203 --> N200
  N203 --> N196
  N204 --> N205
  N204 --> N206
  N207 --> N205
  N208 --> N205
  N209 --> N205
  N210 --> N205
  N211 --> N212
  N211 --> N205
  N213 --> N212
  N213 --> N204
  N214 --> N212
  N214 --> N205
  N214 --> N207
  N215 --> N212
  N215 --> N205
  N216 --> N212
  N216 --> N210
  N217 --> N212
  N217 --> N205
  N218 --> N212
  N218 --> N205
  N218 --> N206
  N219 --> N212
  N219 --> N205
  N220 --> N211
  N220 --> N213
  N220 --> N214
  N220 --> N215
  N220 --> N216
  N220 --> N217
  N220 --> N218
  N220 --> N219
  N220 --> N221
  N220 --> N222
  N220 --> N223
  N220 --> N224
  N220 --> N225
  N220 --> N226
  N220 --> N227
  N220 --> N228
  N220 --> N229
  N221 --> N212
  N221 --> N205
  N221 --> N230
  N223 --> N212
  N223 --> N205
  N224 --> N212
  N224 --> N205
  N225 --> N212
  N225 --> N205
  N226 --> N212
  N226 --> N205
  N226 --> N231
  N226 --> N232
  N227 --> N212
  N227 --> N205
  N228 --> N212
  N228 --> N205
  N229 --> N212
  N229 --> N205
  N222 --> N212
  N222 --> N205
  N233 --> N212
  N233 --> N224
  N234 --> N205
  N230 --> N205
  N206 --> N205
  N235 --> N205
  N236 --> N206
  N237 --> N238
  N239 --> N205
  N240 --> N241
  N240 --> N238
  N242 --> N243
  N244 --> N245
  N244 --> N241
  N246 --> N241
  N246 --> N247
  N248 --> N241
  N249 --> N241
  N250 --> N241
  N251 --> N241
  N251 --> N238
  N251 --> N252
  N253 --> N254
  N255 --> N205
  N255 --> N238
  N256 --> N205
  N256 --> N257
  N258 --> N205
  N232 --> N205
  N232 --> N259
  N232 --> N260
  N260 --> N205
  N261 --> N262
  N263 --> N205
  N264 --> N265
  N264 --> N266
  N266 --> N205
  N267 --> N205
  N231 --> N205
  N259 --> N205
  N268 --> N269
  N270 --> N205
  N270 --> N257
  N271 --> N265
  N272 --> N195
  N272 --> N180
  N273 --> N274
  N275 --> N276
  N277 --> N180
  N278 --> N180
  N279 --> N280
  N279 --> N281
  N279 --> N275
  N282 --> N283
  N282 --> N284
  N281 --> N285
  N281 --> N286
  N281 --> N282
```
