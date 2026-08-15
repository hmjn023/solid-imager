# solid-imager detail 03 - server infrastructure and routes

```mermaid
graph LR
  N0[infrastructure/ai/rust-ai-client.ts]
  N1[npm:node:os]
  N2[npm:node:path]
  N3[apps/server/node_modules/@solid-imager/client/src/index.ts]
  N4[npm:@solid-imager/core/domain/contract]
  N5[npm:@solid-imager/core/domain/interfaces/ai-client]
  N6[infrastructure/api-clients/ai-api.ts]
  N7[npm:@solid-imager/core/domain/tagging/schemas]
  N8[apps/server/node_modules/zod/index.d.cts]
  N9[npm:~/infrastructure/api-clients/orpc-client]
  N10[infrastructure/api-clients/characters-api.ts]
  N11[infrastructure/api-clients/downloads-api.ts]
  N12[npm:@solid-imager/core/domain/media/schemas]
  N13[infrastructure/api-clients/fetch-url-api.ts]
  N14[infrastructure/api-clients/ips-api.ts]
  N15[infrastructure/api-clients/media-api.ts]
  N16[infrastructure/api-clients/search-api.ts]
  N17[infrastructure/api-clients/orpc-client.ts]
  N18[apps/server/node_modules/@orpc/server/dist/index.d.mts]
  N19[npm:@tanstack/solid-start]
  N20[npm:@tanstack/solid-start/server]
  N21[npm:~/infrastructure/api/app-router]
  N22[infrastructure/api-clients/projects-api.ts]
  N23[infrastructure/api-clients/queries/index.ts]
  N24[apps/server/node_modules/@orpc/solid-query/dist/index.d.mts]
  N25[infrastructure/api-clients/sources-api.ts]
  N26[npm:@solid-imager/core/domain/sources/schemas]
  N27[infrastructure/api-clients/thumbnails.ts]
  N28[infrastructure/api/clients/preset-client.ts]
  N29[npm:@solid-imager/core/domain/contract/presets-client]
  N30[infrastructure/api/routers/ai-router.ts]
  N31[infrastructure/api/routers/authors-router.ts]
  N32[npm:@solid-imager/core/domain/contract/authors.contract]
  N33[npm:~/infrastructure/repositories/authors-repository]
  N34[infrastructure/api/routers/categories-router.ts]
  N35[npm:@solid-imager/core/domain/contract/categories.contract]
  N36[npm:~/infrastructure/services/category-service]
  N37[infrastructure/api/routers/characters-router.ts]
  N38[npm:@solid-imager/core/domain/contract/characters.contract]
  N39[npm:~/infrastructure/services/character-service]
  N40[infrastructure/api/routers/entity-media-counts.ts]
  N41[infrastructure/api/routers/config-router.ts]
  N42[npm:@solid-imager/core/domain/contract/config.contract]
  N43[npm:~/infrastructure/service-registry]
  N44[infrastructure/api/routers/directories-router.ts]
  N45[npm:@solid-imager/core/domain/contract/directories.contract]
  N46[npm:~/infrastructure/services/directory-service]
  N47[infrastructure/api/routers/downloads-router.ts]
  N48[npm:@solid-imager/core/domain/contract/downloads.contract]
  N49[npm:~/infrastructure/jobs/download-jobs]
  N50[infrastructure/api/routers/imports-router.ts]
  N51[npm:@solid-imager/core/domain/contract/imports.contract]
  N52[npm:@solid-imager/core/domain/sources/events]
  N53[apps/server/node_modules/drizzle-orm/index.d.ts]
  N54[npm:~/infrastructure/db]
  N55[npm:~/infrastructure/db/schema]
  N56[npm:~/infrastructure/events/realtime-event-bus]
  N57[npm:~/infrastructure/services/backup-service]
  N58[infrastructure/api/routers/ips-router.ts]
  N59[npm:@solid-imager/core/domain/contract/ips.contract]
  N60[npm:~/infrastructure/services/ip-service]
  N61[infrastructure/api/routers/media-router.ts]
  N62[npm:@solid-imager/core/domain/contract/media.contract]
  N63[npm:@solid-imager/core/domain/errors]
  N64[npm:@solid-imager/core/utils/async-pool]
  N65[npm:~/infrastructure/logger]
  N66[npm:~/infrastructure/services/bulk-operation-service]
  N67[npm:~/infrastructure/services/ccip-vector-service]
  N68[npm:~/infrastructure/services/media-service]
  N69[infrastructure/api/routers/presets-router.ts]
  N70[npm:@solid-imager/core/domain/contract/presets.contract]
  N71[npm:~/infrastructure/services/preset-service]
  N72[infrastructure/api/routers/projects-router.ts]
  N73[npm:@solid-imager/core/domain/contract/projects.contract]
  N74[npm:~/infrastructure/services/project-service]
  N75[infrastructure/api/routers/sources-router.ts]
  N76[infrastructure/api/routers/tags-router.ts]
  N77[npm:@solid-imager/core/domain/contract/tags.contract]
  N78[npm:~/infrastructure/services/tag-service]
  N79[infrastructure/api/routers/thumbnails-router.ts]
  N80[npm:@solid-imager/core/domain/contract/thumbnails.contract]
  N81[npm:~/infrastructure/services/thumbnail-service]
  N82[infrastructure/api/routers/utils-router.ts]
  N83[npm:@solid-imager/core/domain/contract/utils.contract]
  N84[infrastructure/api/routers/jobs-router.ts]
  N85[npm:@solid-imager/core/domain/contract/jobs.contract]
  N86[infrastructure/api/job-artifact.ts]
  N87[npm:node:fs]
  N88[npm:node:fs/promises]
  N89[npm:@solid-imager/core/domain/repositories/job-repository]
  N90[npm:~/infrastructure/repositories/job-repository]
  N91[npm:~/infrastructure/services/job-transfer-storage]
  N92[npm:~/infrastructure/utils/stream-utils]
  N93[infrastructure/api/app-router.ts]
  N94[npm:~/infrastructure/api/routers/ai-router]
  N95[npm:~/infrastructure/api/routers/authors-router]
  N96[npm:~/infrastructure/api/routers/categories-router]
  N97[npm:~/infrastructure/api/routers/characters-router]
  N98[npm:~/infrastructure/api/routers/config-router]
  N99[npm:~/infrastructure/api/routers/directories-router]
  N100[npm:~/infrastructure/api/routers/downloads-router]
  N101[npm:~/infrastructure/api/routers/imports-router]
  N102[npm:~/infrastructure/api/routers/ips-router]
  N103[npm:~/infrastructure/api/routers/jobs-router]
  N104[npm:~/infrastructure/api/routers/media-router]
  N105[npm:~/infrastructure/api/routers/presets-router]
  N106[npm:~/infrastructure/api/routers/projects-router]
  N107[npm:~/infrastructure/api/routers/sources-router]
  N108[npm:~/infrastructure/api/routers/tags-router]
  N109[npm:~/infrastructure/api/routers/thumbnails-router]
  N110[npm:~/infrastructure/api/routers/utils-router]
  N111[infrastructure/bootstrap.ts]
  N112[npm:~/infrastructure/ai/rust-ai-client]
  N113[npm:~/infrastructure/db/transaction-manager]
  N114[npm:~/infrastructure/file-system/node-file-system]
  N115[npm:~/infrastructure/jobs/download-rate-limiter]
  N116[npm:~/infrastructure/jobs/job-worker]
  N117[infrastructure/db/__mocks__/index.ts]
  N118[npm:uuid]
  N119[apps/server/node_modules/vitest/dist/index.js]
  N120[infrastructure/db/connection.ts]
  N121[apps/server/node_modules/@electric-sql/pglite/dist/index.cjs]
  N122[apps/server/node_modules/pg/esm/index.mjs]
  N123[npm:~/config/database]
  N124[infrastructure/db/pglite.ts]
  N125[infrastructure/db/data-migration.ts]
  N126[npm:~/infrastructure/db/index]
  N127[infrastructure/db/executor.ts]
  N128[npm:@solid-imager/db/types]
  N129[infrastructure/db/index.ts]
  N130[apps/server/node_modules/drizzle-orm/node-postgres/index.d.ts]
  N131[apps/server/node_modules/drizzle-orm/pglite/index.d.ts]
  N132[infrastructure/db/schema.ts]
  N133[apps/server/node_modules/@electric-sql/pglite-pgvector/dist/index.cjs]
  N134[infrastructure/file-system/node-file-system.ts]
  N135[apps/server/node_modules/@solid-imager/core/src/index.ts]
  N136[infrastructure/jobs/download-jobs.ts]
  N137[infrastructure/jobs/download-rate-limiter.ts]
  N138[npm:@solid-imager/core/domain/config/config-schema]
  N139[infrastructure/jobs/file-watcher-service.ts]
  N140[npm:~/infrastructure/jobs/file-watcher-manager]
  N141[npm:~/infrastructure/jobs/thumbnails]
  N142[npm:~/infrastructure/repositories/media-repository]
  N143[npm:~/infrastructure/repositories/source-repository]
  N144[npm:~/infrastructure/services/directory-sync-service]
  N145[npm:~/infrastructure/services/media-processing-service]
  N146[npm:~/infrastructure/storage/server-media-storage]
  N147[infrastructure/jobs/job-worker.ts]
  N148[npm:~/domain/repositories/job-repository]
  N149[infrastructure/jobs/tagging-jobs.ts]
  N150[infrastructure/jobs/tag-extraction.ts]
  N151[npm:~/infrastructure/processing/image-processor]
  N152[npm:~/infrastructure/repositories/tag-repository]
  N153[infrastructure/jobs/ccip-jobs.ts]
  N154[npm:@solid-imager/application/ports/ccip-vector-store]
  N155[infrastructure/jobs/thumbnails.ts]
  N156[infrastructure/jobs/file-watcher-manager.ts]
  N157[apps/server/node_modules/chokidar/index.js]
  N158[infrastructure/logger.ts]
  N159[apps/server/node_modules/pino/pino.js]
  N160[infrastructure/processing/image-processor.ts]
  N161[apps/server/node_modules/sharp/dist/index.cjs]
  N162[infrastructure/repositories/author-repository.ts]
  N163[npm:@solid-imager/core/domain/repositories/author-repository]
  N164[npm:@solid-imager/db/repositories/author-repository]
  N165[npm:~/infrastructure/db/executor]
  N166[infrastructure/repositories/authors-repository.ts]
  N167[npm:@solid-imager/core/domain/repositories/authors-repository]
  N168[npm:@solid-imager/db/repositories/authors-repository]
  N169[infrastructure/repositories/category-repository.ts]
  N170[npm:@solid-imager/core/domain/repositories/category-repository]
  N171[npm:@solid-imager/db/repositories/category-repository]
  N172[infrastructure/repositories/character-repository.ts]
  N173[npm:@solid-imager/core/domain/repositories/character-repository]
  N174[npm:@solid-imager/db/repositories/character-repository]
  N175[infrastructure/repositories/collection-repository.ts]
  N176[npm:@solid-imager/core/domain/repositories/collection-repository]
  N177[npm:@solid-imager/db/repositories/collection-repository]
  N178[infrastructure/repositories/ip-repository.ts]
  N179[npm:@solid-imager/core/domain/repositories/ip-repository]
  N180[npm:@solid-imager/db/repositories/ip-repository]
  N181[infrastructure/repositories/job-repository.ts]
  N182[npm:@solid-imager/db/repositories/job-repository]
  N183[infrastructure/repositories/media-repository-utils.ts]
  N184[npm:@solid-imager/db/repositories/media-repository-utils]
  N185[infrastructure/repositories/media-repository.ts]
  N186[npm:@solid-imager/core/domain/repositories/media-repository]
  N187[npm:@solid-imager/db/repositories/media-repository]
  N188[npm:~/infrastructure/repositories/author-repository]
  N189[infrastructure/repositories/preset-repository.ts]
  N190[npm:@solid-imager/core/domain/repositories/preset-repository]
  N191[npm:@solid-imager/db/repositories/preset-repository]
  N192[infrastructure/repositories/project-repository.ts]
  N193[npm:@solid-imager/core/domain/repositories/project-repository]
  N194[npm:@solid-imager/db/repositories/project-repository]
  N195[infrastructure/repositories/source-repository.ts]
  N196[npm:@solid-imager/core/domain/repositories/source-repository]
  N197[npm:@solid-imager/db/repositories/source-repository]
  N198[infrastructure/repositories/tag-repository.ts]
  N199[npm:@solid-imager/core/domain/repositories/tag-repository]
  N200[npm:@solid-imager/db/repositories/tag-repository]
  N201[infrastructure/repositories/user-repository.ts]
  N202[npm:@solid-imager/core/domain/repositories/user-repository]
  N203[npm:@solid-imager/db/repositories/user-repository]
  N204[infrastructure/storage/factory.ts]
  N205[infrastructure/storage/local.ts]
  N206[infrastructure/storage/schema.ts]
  N207[npm:node:stream]
  N208[infrastructure/storage/server-media-storage.ts]
  N209[infrastructure/utils/ffmpeg.ts]
  N210[apps/server/node_modules/fluent-ffmpeg/index.js]
  N211[infrastructure/utils/stream-utils.ts]
  N212[infrastructure/events/realtime-event-bus.ts]
  N213[npm:node:events]
  N214[infrastructure/router/route-types.ts]
  N215[apps/server/node_modules/@tanstack/solid-query/build/index.cjs]
  N216[infrastructure/server-route-bootstrap.ts]
  N217[infrastructure/services/author-service.ts]
  N218[npm:@solid-imager/application/services/author-service]
  N219[infrastructure/services/backup-service.ts]
  N220[npm:node:stream/promises]
  N221[infrastructure/services/bulk-operation-service.ts]
  N222[infrastructure/services/category-service.ts]
  N223[npm:@solid-imager/application/services/category-service]
  N224[npm:~/infrastructure/repositories/category-repository]
  N225[infrastructure/services/ccip-vector-service.ts]
  N226[npm:@solid-imager/application/ports/media-service]
  N227[npm:@solid-imager/application/services/ccip-vector-service]
  N228[npm:~/infrastructure/ai/postgres-ccip-vector-store]
  N229[npm:~/infrastructure/services/tagging-service]
  N230[infrastructure/services/collection-service.ts]
  N231[npm:@solid-imager/application/services/collection-service]
  N232[npm:~/infrastructure/repositories/collection-repository]
  N233[infrastructure/services/directory-service.ts]
  N234[npm:~/infrastructure/services/media-source-service]
  N235[npm:~/infrastructure/storage/factory]
  N236[infrastructure/services/directory-sync-service.ts]
  N237[infrastructure/services/ip-service.ts]
  N238[npm:@solid-imager/application/services/ip-service]
  N239[npm:~/infrastructure/repositories/ip-repository]
  N240[infrastructure/services/job-dispatch-service.ts]
  N241[infrastructure/services/job-transfer-storage.ts]
  N242[infrastructure/services/maintenance-service.ts]
  N243[infrastructure/services/media-processing-service.ts]
  N244[npm:@solid-imager/core/domain/interfaces/transaction-manager]
  N245[infrastructure/services/preset-service.ts]
  N246[apps/server/node_modules/@solid-imager/application/src/index.ts]
  N247[npm:@solid-imager/application/services/preset-service]
  N248[npm:~/infrastructure/repositories/preset-repository]
  N249[infrastructure/services/project-service.ts]
  N250[npm:@solid-imager/application/services/project-service]
  N251[npm:~/infrastructure/repositories/project-repository]
  N252[infrastructure/services/search-service.ts]
  N253[npm:@solid-imager/application/services/search-service]
  N254[infrastructure/services/server-config-service.ts]
  N255[npm:node:util]
  N256[infrastructure/services/source-transfer-job-service.ts]
  N257[infrastructure/services/tag-service.ts]
  N258[npm:@solid-imager/application/services/tag-service]
  N259[infrastructure/services/tagging-service.ts]
  N260[npm:@solid-imager/application/services/tagging-service]
  N261[infrastructure/services/thumbnail-service.ts]
  N262[npm:@solid-imager/core/domain/thumbnails/schemas]
  N263[infrastructure/services/user-service.ts]
  N264[npm:@solid-imager/application/services/user-service]
  N265[npm:~/infrastructure/repositories/user-repository]
  N266[routes/$.tsx]
  N267[npm:@solid-imager/ui/screens/not-found-screen]
  N268[apps/server/node_modules/@tanstack/solid-router/dist/cjs/index.cjs]
  N269[routes/__root.tsx]
  N270[npm:@solid-imager/ui/layouts/app-shell]
  N271[npm:@solid-imager/ui/router-status]
  N272[npm:@solid-imager/ui/toast]
  N273[routes/about.tsx]
  N274[npm:@solid-imager/ui/counter]
  N275[routes/api/rpc.$.ts]
  N276[npm:@orpc/server/fetch]
  N277[npm:@orpc/server/plugins]
  N278[npm:~/infrastructure/api/rpc-response-headers]
  N279[npm:~/infrastructure/router/route-types]
  N280[npm:~/infrastructure/server-route-bootstrap]
  N281[routes/api/sources.$mediaSourceId.$mediaId.ts]
  N282[npm:@solid-imager/core/domain/media/utils/media-type-utils]
  N283[routes/api/jobs.$jobId.artifact.ts]
  N284[routes/api/sources.$mediaSourceId.thumbnail.$mediaId.ts]
  N285[routes/config.tsx]
  N286[npm:@solid-imager/ui/query-options]
  N287[npm:@solid-imager/ui/query-state]
  N288[npm:@solid-imager/ui/screens/legacy-config-state-screen]
  N289[npm:~/infrastructure/api-clients/queries]
  N290[routes/v2/$.tsx]
  N291[npm:@solid-imager/ui/button]
  N292[npm:@solid-imager/ui/v2/icons]
  N293[routes/v2/about.tsx]
  N294[npm:@solid-imager/ui/badge]
  N295[routes/v2/config.tsx]
  N296[npm:@solid-imager/ui/screens/v2-config-state-screen]
  N297[routes/v2/index.tsx]
  N298[routes/v2/jobs.tsx]
  N299[npm:@solid-imager/core/domain/jobs/schemas]
  N300[npm:@solid-imager/ui/hooks/use-job-events]
  N301[npm:@solid-imager/ui/screens/v2-jobs-screen]
  N302[routes/v2/manager.tsx]
  N303[npm:@solid-imager/ui/hooks/use-manager-page]
  N304[npm:@solid-imager/ui/screens/v2-manager/types]
  N305[npm:@solid-imager/ui/screens/v2-manager-screen]
  N306[npm:~/hooks/use-batch-job-events]
  N307[routes/v2/media-context.ts]
  N308[routes/v2/route.tsx]
  N309[apps/server/node_modules/solid-js/types/index.d.ts]
  N310[npm:~/components/api-activity-indicator]
  N311[npm:~/components/v2/v2-app-shell]
  N312[routes/v2/search.tsx]
  N313[routes/v2/sources/$mediaSourceId/$mediaId/index.tsx]
  N314[npm:@solid-imager/ui/screens/v2-media-detail-screen]
  N315[routes/v2/sources/$mediaSourceId/index.tsx]
  N316[npm:~/routes/sources/$mediaSourceId/components/v2-source-media-page]
  N317[routes/docs/swagger/index.tsx]
  N318[routes/index.tsx]
  N319[routes/manager.tsx]
  N320[npm:@solid-imager/ui/screens/manager-screen]
  N321[routes/search.tsx]
  N322[routes/sources/$mediaSourceId/$mediaId/index.tsx]
  N323[npm:@solid-imager/ui/screens/legacy-media-detail-screen]
  N324[routes/sources/$mediaSourceId/components/source-media-page.tsx]
  N325[npm:@solid-imager/ui/hooks/use-current-search-persistence]
  N326[npm:@solid-imager/ui/preset-client]
  N327[npm:@solid-imager/ui/screens/source-media-screen.types]
  N328[npm:@solid-imager/ui/source-media-page]
  N329[routes/sources/$mediaSourceId/components/legacy-source-media-page.tsx]
  N330[npm:@solid-imager/ui/screens/source-media-screen]
  N331[npm:~/components/media/legacy-media-grid-item]
  N332[npm:~/components/upload-media-modal]
  N333[routes/sources/$mediaSourceId/components/v2-source-media-page.tsx]
  N334[npm:@solid-imager/ui/screens/v2-source-media-screen]
  N335[npm:~/components/media/thumbnail-image]
  N336[npm:~/components/media/v2-media-grid-item]
  N337[npm:~/components/v2-upload-media-modal]
  N338[npm:~/routes/v2/media-context]
  N339[routes/sources/$mediaSourceId/index.tsx]
  N340[routes/sources/index.tsx]
  N341[npm:@solid-imager/ui/hooks/use-sources-events]
  N342[npm:@solid-imager/ui/hooks/use-sources-page]
  N343[npm:@solid-imager/ui/legacy-source-form-modal]
  N344[npm:@solid-imager/ui/screens/sources-screen]
  N345[npm:@solid-imager/ui/source-card]
  N346[npm:@solid-imager/ui/source-delete-modal]
  N347[npm:~/hooks/use-media-source-events]
  N348[routes/design-lab.tsx]
  N349[npm:@solid-imager/ui/screens/design-concept-screen]
  N0 --> N1
  N0 --> N2
  N0 --> N3
  N0 --> N4
  N0 --> N5
  N6 --> N7
  N6 --> N8
  N6 --> N9
  N10 --> N9
  N11 --> N12
  N11 --> N9
  N13 --> N9
  N14 --> N9
  N15 --> N9
  N15 --> N16
  N17 --> N18
  N17 --> N3
  N17 --> N4
  N17 --> N19
  N17 --> N20
  N17 --> N21
  N22 --> N9
  N23 --> N24
  N16 --> N12
  N16 --> N9
  N25 --> N3
  N25 --> N26
  N25 --> N8
  N25 --> N9
  N27 --> N9
  N28 --> N29
  N28 --> N9
  N30 --> N1
  N30 --> N2
  N30 --> N18
  N31 --> N18
  N31 --> N32
  N31 --> N33
  N34 --> N18
  N34 --> N35
  N34 --> N36
  N37 --> N18
  N37 --> N38
  N37 --> N39
  N37 --> N40
  N41 --> N18
  N41 --> N42
  N41 --> N43
  N44 --> N18
  N44 --> N45
  N44 --> N46
  N47 --> N18
  N47 --> N48
  N47 --> N49
  N50 --> N18
  N50 --> N51
  N50 --> N12
  N50 --> N52
  N50 --> N53
  N50 --> N8
  N50 --> N54
  N50 --> N55
  N50 --> N56
  N50 --> N49
  N50 --> N57
  N58 --> N18
  N58 --> N59
  N58 --> N60
  N58 --> N40
  N61 --> N18
  N61 --> N62
  N61 --> N63
  N61 --> N64
  N61 --> N65
  N61 --> N66
  N61 --> N67
  N61 --> N68
  N69 --> N18
  N69 --> N70
  N69 --> N71
  N72 --> N18
  N72 --> N73
  N72 --> N74
  N72 --> N40
  N75 --> N18
  N76 --> N18
  N76 --> N77
  N76 --> N78
  N79 --> N18
  N79 --> N80
  N79 --> N81
  N82 --> N18
  N82 --> N83
  N84 --> N18
  N84 --> N85
  N40 --> N53
  N40 --> N54
  N86 --> N87
  N86 --> N88
  N86 --> N89
  N86 --> N90
  N86 --> N91
  N86 --> N92
  N93 --> N18
  N93 --> N4
  N93 --> N94
  N93 --> N95
  N93 --> N96
  N93 --> N97
  N93 --> N98
  N93 --> N99
  N93 --> N100
  N93 --> N101
  N93 --> N102
  N93 --> N103
  N93 --> N104
  N93 --> N105
  N93 --> N106
  N93 --> N107
  N93 --> N108
  N93 --> N109
  N93 --> N110
  N111 --> N112
  N111 --> N113
  N111 --> N56
  N111 --> N114
  N111 --> N115
  N111 --> N116
  N117 --> N118
  N117 --> N119
  N117 --> N55
  N120 --> N121
  N120 --> N122
  N120 --> N123
  N120 --> N124
  N125 --> N53
  N125 --> N126
  N127 --> N128
  N127 --> N126
  N129 --> N2
  N129 --> N121
  N129 --> N130
  N129 --> N131
  N129 --> N122
  N129 --> N65
  N129 --> N124
  N129 --> N132
  N124 --> N121
  N124 --> N133
  N134 --> N88
  N134 --> N135
  N136 --> N88
  N136 --> N1
  N136 --> N2
  N137 --> N138
  N139 --> N2
  N139 --> N56
  N139 --> N140
  N139 --> N141
  N139 --> N65
  N139 --> N142
  N139 --> N143
  N139 --> N43
  N139 --> N67
  N139 --> N144
  N139 --> N145
  N139 --> N146
  N147 --> N138
  N147 --> N148
  N147 --> N55
  N147 --> N56
  N147 --> N65
  N149 --> N7
  N149 --> N53
  N149 --> N8
  N149 --> N54
  N150 --> N151
  N150 --> N152
  N153 --> N154
  N155 --> N88
  N155 --> N2
  N155 --> N7
  N156 --> N2
  N156 --> N157
  N156 --> N56
  N156 --> N65
  N158 --> N159
  N160 --> N161
  N162 --> N163
  N162 --> N164
  N162 --> N165
  N166 --> N167
  N166 --> N168
  N166 --> N165
  N169 --> N170
  N169 --> N171
  N169 --> N165
  N172 --> N173
  N172 --> N174
  N172 --> N165
  N175 --> N176
  N175 --> N177
  N175 --> N165
  N178 --> N179
  N178 --> N180
  N178 --> N165
  N181 --> N89
  N181 --> N182
  N181 --> N165
  N183 --> N184
  N183 --> N165
  N185 --> N186
  N185 --> N187
  N185 --> N184
  N185 --> N165
  N185 --> N65
  N185 --> N188
  N185 --> N152
  N189 --> N190
  N189 --> N191
  N189 --> N165
  N192 --> N193
  N192 --> N194
  N192 --> N165
  N195 --> N196
  N195 --> N197
  N195 --> N165
  N198 --> N199
  N198 --> N200
  N198 --> N165
  N201 --> N202
  N201 --> N203
  N201 --> N165
  N204 --> N26
  N204 --> N205
  N204 --> N206
  N205 --> N87
  N205 --> N88
  N205 --> N2
  N205 --> N26
  N205 --> N206
  N206 --> N87
  N206 --> N207
  N208 --> N88
  N208 --> N2
  N209 --> N210
  N209 --> N65
  N211 --> N207
  N212 --> N213
  N214 --> N215
  N216 --> N111
  N217 --> N218
  N217 --> N188
  N219 --> N87
  N219 --> N88
  N219 --> N2
  N219 --> N207
  N219 --> N220
  N221 --> N12
  N221 --> N141
  N221 --> N65
  N221 --> N43
  N222 --> N223
  N222 --> N224
  N225 --> N226
  N225 --> N227
  N225 --> N228
  N225 --> N54
  N225 --> N43
  N225 --> N229
  N230 --> N231
  N230 --> N232
  N233 --> N234
  N233 --> N235
  N236 --> N88
  N236 --> N2
  N236 --> N26
  N236 --> N56
  N236 --> N141
  N236 --> N65
  N236 --> N142
  N236 --> N143
  N236 --> N43
  N236 --> N67
  N236 --> N145
  N237 --> N238
  N237 --> N239
  N240 --> N226
  N240 --> N89
  N240 --> N56
  N241 --> N87
  N241 --> N88
  N241 --> N2
  N241 --> N220
  N241 --> N89
  N241 --> N92
  N242 --> N88
  N242 --> N2
  N242 --> N186
  N242 --> N196
  N242 --> N148
  N242 --> N141
  N242 --> N65
  N243 --> N244
  N243 --> N12
  N243 --> N89
  N243 --> N43
  N245 --> N246
  N245 --> N247
  N245 --> N190
  N245 --> N248
  N249 --> N250
  N249 --> N251
  N252 --> N253
  N252 --> N43
  N254 --> N87
  N254 --> N88
  N254 --> N2
  N254 --> N255
  N254 --> N135
  N256 --> N87
  N256 --> N88
  N256 --> N2
  N256 --> N220
  N257 --> N258
  N257 --> N152
  N259 --> N260
  N259 --> N56
  N259 --> N65
  N259 --> N43
  N261 --> N262
  N263 --> N264
  N263 --> N265
  N266 --> N267
  N266 --> N268
  N269 --> N270
  N269 --> N271
  N269 --> N272
  N269 --> N215
  N273 --> N274
  N273 --> N268
  N275 --> N276
  N275 --> N277
  N275 --> N268
  N275 --> N21
  N275 --> N278
  N275 --> N65
  N275 --> N279
  N275 --> N280
  N281 --> N2
  N281 --> N282
  N281 --> N26
  N281 --> N268
  N281 --> N279
  N281 --> N280
  N281 --> N43
  N283 --> N268
  N284 --> N262
  N284 --> N268
  N285 --> N286
  N285 --> N287
  N285 --> N271
  N285 --> N288
  N285 --> N215
  N285 --> N268
  N285 --> N9
  N285 --> N289
  N285 --> N279
  N290 --> N291
  N290 --> N292
  N290 --> N268
  N293 --> N294
  N293 --> N291
  N295 --> N286
  N295 --> N287
  N295 --> N296
  N295 --> N215
  N295 --> N268
  N295 --> N9
  N295 --> N289
  N297 --> N268
  N298 --> N299
  N298 --> N300
  N298 --> N286
  N298 --> N287
  N298 --> N301
  N298 --> N272
  N298 --> N215
  N298 --> N268
  N298 --> N9
  N298 --> N289
  N302 --> N303
  N302 --> N286
  N302 --> N304
  N302 --> N305
  N302 --> N272
  N302 --> N215
  N302 --> N268
  N302 --> N306
  N307 --> N12
  N308 --> N271
  N308 --> N268
  N308 --> N309
  N308 --> N310
  N308 --> N311
  N312 --> N268
  N313 --> N12
  N313 --> N291
  N313 --> N314
  N315 --> N268
  N315 --> N316
  N317 --> N268
  N318 --> N274
  N318 --> N268
  N319 --> N303
  N319 --> N271
  N319 --> N320
  N319 --> N215
  N319 --> N268
  N319 --> N309
  N319 --> N306
  N321 --> N291
  N322 --> N271
  N322 --> N323
  N324 --> N12
  N324 --> N291
  N324 --> N325
  N324 --> N326
  N324 --> N286
  N324 --> N271
  N324 --> N327
  N324 --> N328
  N324 --> N215
  N324 --> N268
  N329 --> N330
  N329 --> N309
  N329 --> N331
  N329 --> N332
  N329 --> N324
  N333 --> N334
  N333 --> N268
  N333 --> N309
  N333 --> N335
  N333 --> N336
  N333 --> N337
  N333 --> N338
  N339 --> N271
  N339 --> N268
  N339 --> N309
  N340 --> N26
  N340 --> N341
  N340 --> N342
  N340 --> N343
  N340 --> N287
  N340 --> N271
  N340 --> N344
  N340 --> N345
  N340 --> N346
  N340 --> N215
  N340 --> N268
  N340 --> N347
  N340 --> N289
  N348 --> N349
  N348 --> N268
```
