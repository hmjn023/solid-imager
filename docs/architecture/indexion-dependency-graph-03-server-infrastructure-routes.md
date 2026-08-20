# solid-imager detail 03 - server infrastructure and routes

```mermaid
graph LR
  N0[infrastructure/ai/rust-ai-client.ts]
  N1[npm:node:os]
  N2[npm:node:path]
  N3[apps/server/node_modules/@solid-imager/client/src/index.ts]
  N4[npm:@solid-imager/core/domain/config/config-schema]
  N5[npm:@solid-imager/core/domain/contract]
  N6[npm:@solid-imager/core/domain/interfaces/ai-client]
  N7[infrastructure/ai/inference-options.ts]
  N8[apps/server/node_modules/dghs-imgutils-rs/index.js]
  N9[infrastructure/api-clients/ai-api.ts]
  N10[npm:@solid-imager/core/domain/tagging/schemas]
  N11[apps/server/node_modules/zod/index.d.cts]
  N12[npm:~/infrastructure/api-clients/orpc-client]
  N13[infrastructure/api-clients/orpc-client.ts]
  N14[apps/server/node_modules/@orpc/server/dist/index.d.mts]
  N15[npm:@tanstack/solid-start]
  N16[npm:@tanstack/solid-start/server]
  N17[npm:~/infrastructure/api/app-router]
  N18[infrastructure/api-clients/characters-api.ts]
  N19[infrastructure/api-clients/downloads-api.ts]
  N20[npm:@solid-imager/core/domain/media/schemas]
  N21[infrastructure/api-clients/fetch-url-api.ts]
  N22[infrastructure/api-clients/ips-api.ts]
  N23[infrastructure/api-clients/media-api.ts]
  N24[infrastructure/api-clients/search-api.ts]
  N25[infrastructure/api-clients/projects-api.ts]
  N26[infrastructure/api-clients/queries/index.ts]
  N27[apps/server/node_modules/@orpc/solid-query/dist/index.d.mts]
  N28[infrastructure/api-clients/sources-api.ts]
  N29[npm:@solid-imager/core/domain/sources/schemas]
  N30[infrastructure/api-clients/thumbnails.ts]
  N31[infrastructure/api/clients/preset-client.ts]
  N32[npm:@solid-imager/core/domain/contract/presets-client]
  N33[infrastructure/api/clients/search-history-client.ts]
  N34[npm:@solid-imager/core/domain/contract/search-snapshots-client]
  N35[infrastructure/api/routers/ai-router.ts]
  N36[infrastructure/api/routers/authors-router.ts]
  N37[npm:@solid-imager/core/domain/contract/authors.contract]
  N38[npm:~/infrastructure/repositories/authors-repository]
  N39[infrastructure/api/routers/categories-router.ts]
  N40[npm:@solid-imager/core/domain/contract/categories.contract]
  N41[npm:~/infrastructure/services/category-service]
  N42[infrastructure/api/routers/characters-router.ts]
  N43[npm:@solid-imager/core/domain/contract/characters.contract]
  N44[npm:~/infrastructure/services/character-service]
  N45[infrastructure/api/routers/entity-media-counts.ts]
  N46[infrastructure/api/routers/config-router.ts]
  N47[npm:@solid-imager/core/domain/contract/config.contract]
  N48[npm:~/infrastructure/service-registry]
  N49[infrastructure/api/routers/directories-router.ts]
  N50[npm:@solid-imager/core/domain/contract/directories.contract]
  N51[npm:~/infrastructure/services/directory-service]
  N52[infrastructure/api/routers/downloads-router.ts]
  N53[npm:@solid-imager/core/domain/contract/downloads.contract]
  N54[npm:~/infrastructure/jobs/download-jobs]
  N55[infrastructure/api/routers/imports-router.ts]
  N56[npm:@solid-imager/core/domain/contract/imports.contract]
  N57[npm:@solid-imager/core/domain/sources/events]
  N58[apps/server/node_modules/drizzle-orm/index.d.ts]
  N59[npm:~/infrastructure/db]
  N60[npm:~/infrastructure/db/schema]
  N61[npm:~/infrastructure/events/realtime-event-bus]
  N62[npm:~/infrastructure/services/backup-service]
  N63[infrastructure/api/routers/ips-router.ts]
  N64[npm:@solid-imager/core/domain/contract/ips.contract]
  N65[npm:~/infrastructure/services/ip-service]
  N66[infrastructure/api/routers/media-router.ts]
  N67[npm:@solid-imager/core/domain/contract/media.contract]
  N68[npm:@solid-imager/core/domain/errors]
  N69[npm:@solid-imager/core/utils/async-pool]
  N70[npm:~/infrastructure/logger]
  N71[npm:~/infrastructure/services/bulk-operation-service]
  N72[npm:~/infrastructure/services/ccip-vector-service]
  N73[npm:~/infrastructure/services/media-service]
  N74[infrastructure/api/routers/presets-router.ts]
  N75[npm:@solid-imager/core/domain/contract/presets.contract]
  N76[npm:~/infrastructure/services/preset-service]
  N77[infrastructure/api/routers/projects-router.ts]
  N78[npm:@solid-imager/core/domain/contract/projects.contract]
  N79[npm:~/infrastructure/services/project-service]
  N80[infrastructure/api/routers/sources-router.ts]
  N81[infrastructure/api/routers/tags-router.ts]
  N82[npm:@solid-imager/core/domain/contract/tags.contract]
  N83[npm:~/infrastructure/services/tag-service]
  N84[infrastructure/api/routers/thumbnails-router.ts]
  N85[npm:@solid-imager/core/domain/contract/thumbnails.contract]
  N86[npm:~/infrastructure/services/thumbnail-service]
  N87[infrastructure/api/routers/utils-router.ts]
  N88[npm:@solid-imager/core/domain/contract/utils.contract]
  N89[infrastructure/api/routers/jobs-router.ts]
  N90[npm:@solid-imager/core/domain/contract/jobs.contract]
  N91[infrastructure/api/routers/search-snapshots-router.ts]
  N92[npm:@solid-imager/core/domain/contract/search-snapshots.contract]
  N93[npm:~/infrastructure/services/search-snapshot-service]
  N94[infrastructure/api/job-artifact.ts]
  N95[npm:node:fs]
  N96[npm:node:fs/promises]
  N97[npm:@solid-imager/core/domain/repositories/job-repository]
  N98[npm:~/infrastructure/repositories/job-repository]
  N99[npm:~/infrastructure/services/job-transfer-storage]
  N100[npm:~/infrastructure/utils/stream-utils]
  N101[infrastructure/api/app-router.ts]
  N102[npm:~/infrastructure/api/routers/ai-router]
  N103[npm:~/infrastructure/api/routers/authors-router]
  N104[npm:~/infrastructure/api/routers/categories-router]
  N105[npm:~/infrastructure/api/routers/characters-router]
  N106[npm:~/infrastructure/api/routers/config-router]
  N107[npm:~/infrastructure/api/routers/directories-router]
  N108[npm:~/infrastructure/api/routers/downloads-router]
  N109[npm:~/infrastructure/api/routers/imports-router]
  N110[npm:~/infrastructure/api/routers/ips-router]
  N111[npm:~/infrastructure/api/routers/jobs-router]
  N112[npm:~/infrastructure/api/routers/media-router]
  N113[npm:~/infrastructure/api/routers/presets-router]
  N114[npm:~/infrastructure/api/routers/projects-router]
  N115[npm:~/infrastructure/api/routers/search-snapshots-router]
  N116[npm:~/infrastructure/api/routers/sources-router]
  N117[npm:~/infrastructure/api/routers/tags-router]
  N118[npm:~/infrastructure/api/routers/thumbnails-router]
  N119[npm:~/infrastructure/api/routers/utils-router]
  N120[infrastructure/bootstrap.ts]
  N121[npm:~/infrastructure/ai/rust-ai-client]
  N122[npm:~/infrastructure/db/transaction-manager]
  N123[npm:~/infrastructure/file-system/node-file-system]
  N124[npm:~/infrastructure/jobs/download-rate-limiter]
  N125[npm:~/infrastructure/jobs/job-worker]
  N126[infrastructure/db/__mocks__/index.ts]
  N127[npm:uuid]
  N128[apps/server/node_modules/vitest/dist/index.js]
  N129[infrastructure/db/connection.ts]
  N130[apps/server/node_modules/@electric-sql/pglite/dist/index.cjs]
  N131[apps/server/node_modules/pg/esm/index.mjs]
  N132[npm:~/config/database]
  N133[infrastructure/db/pglite.ts]
  N134[infrastructure/db/data-migration.ts]
  N135[npm:~/infrastructure/db/index]
  N136[infrastructure/db/executor.ts]
  N137[npm:@solid-imager/db/types]
  N138[infrastructure/db/index.ts]
  N139[apps/server/node_modules/drizzle-orm/node-postgres/index.d.ts]
  N140[apps/server/node_modules/drizzle-orm/pglite/index.d.ts]
  N141[infrastructure/db/schema.ts]
  N142[apps/server/node_modules/@electric-sql/pglite-pgvector/dist/index.cjs]
  N143[infrastructure/file-system/node-file-system.ts]
  N144[apps/server/node_modules/@solid-imager/core/src/index.ts]
  N145[infrastructure/jobs/download-jobs.ts]
  N146[infrastructure/jobs/download-rate-limiter.ts]
  N147[infrastructure/jobs/file-watcher-service.ts]
  N148[npm:~/infrastructure/jobs/file-watcher-manager]
  N149[npm:~/infrastructure/jobs/thumbnails]
  N150[npm:~/infrastructure/repositories/media-repository]
  N151[npm:~/infrastructure/repositories/source-repository]
  N152[npm:~/infrastructure/services/directory-sync-service]
  N153[npm:~/infrastructure/services/media-processing-service]
  N154[npm:~/infrastructure/storage/server-media-storage]
  N155[infrastructure/jobs/ccip-jobs.ts]
  N156[npm:@solid-imager/application/ports/ccip-vector-store]
  N157[infrastructure/jobs/job-worker.ts]
  N158[npm:~/domain/repositories/job-repository]
  N159[infrastructure/jobs/tagging-jobs.ts]
  N160[infrastructure/jobs/tag-extraction.ts]
  N161[npm:~/infrastructure/processing/image-processor]
  N162[npm:~/infrastructure/repositories/tag-repository]
  N163[infrastructure/jobs/thumbnails.ts]
  N164[infrastructure/jobs/file-watcher-manager.ts]
  N165[apps/server/node_modules/chokidar/index.js]
  N166[infrastructure/logger.ts]
  N167[apps/server/node_modules/pino/pino.js]
  N168[infrastructure/processing/image-processor.ts]
  N169[apps/server/node_modules/sharp/dist/index.cjs]
  N170[infrastructure/repositories/author-repository.ts]
  N171[npm:@solid-imager/core/domain/repositories/author-repository]
  N172[npm:@solid-imager/db/repositories/author-repository]
  N173[npm:~/infrastructure/db/executor]
  N174[infrastructure/repositories/authors-repository.ts]
  N175[npm:@solid-imager/core/domain/repositories/authors-repository]
  N176[npm:@solid-imager/db/repositories/authors-repository]
  N177[infrastructure/repositories/category-repository.ts]
  N178[npm:@solid-imager/core/domain/repositories/category-repository]
  N179[npm:@solid-imager/db/repositories/category-repository]
  N180[infrastructure/repositories/character-repository.ts]
  N181[npm:@solid-imager/core/domain/repositories/character-repository]
  N182[npm:@solid-imager/db/repositories/character-repository]
  N183[infrastructure/repositories/collection-repository.ts]
  N184[npm:@solid-imager/core/domain/repositories/collection-repository]
  N185[npm:@solid-imager/db/repositories/collection-repository]
  N186[infrastructure/repositories/ip-repository.ts]
  N187[npm:@solid-imager/core/domain/repositories/ip-repository]
  N188[npm:@solid-imager/db/repositories/ip-repository]
  N189[infrastructure/repositories/job-repository.ts]
  N190[npm:@solid-imager/db/repositories/job-repository]
  N191[infrastructure/repositories/media-repository-utils.ts]
  N192[npm:@solid-imager/db/repositories/media-repository-utils]
  N193[infrastructure/repositories/media-repository.ts]
  N194[npm:@solid-imager/core/domain/repositories/media-repository]
  N195[npm:@solid-imager/db/repositories/media-repository]
  N196[npm:~/infrastructure/repositories/author-repository]
  N197[infrastructure/repositories/preset-repository.ts]
  N198[npm:@solid-imager/core/domain/repositories/preset-repository]
  N199[npm:@solid-imager/db/repositories/preset-repository]
  N200[infrastructure/repositories/project-repository.ts]
  N201[npm:@solid-imager/core/domain/repositories/project-repository]
  N202[npm:@solid-imager/db/repositories/project-repository]
  N203[infrastructure/repositories/source-repository.ts]
  N204[npm:@solid-imager/core/domain/repositories/source-repository]
  N205[npm:@solid-imager/db/repositories/source-repository]
  N206[infrastructure/repositories/tag-repository.ts]
  N207[npm:@solid-imager/core/domain/repositories/tag-repository]
  N208[npm:@solid-imager/db/repositories/tag-repository]
  N209[infrastructure/repositories/user-repository.ts]
  N210[npm:@solid-imager/core/domain/repositories/user-repository]
  N211[npm:@solid-imager/db/repositories/user-repository]
  N212[infrastructure/repositories/search-snapshot-repository.ts]
  N213[npm:@solid-imager/core/domain/repositories/search-snapshot-repository]
  N214[npm:@solid-imager/db/repositories/search-snapshot-repository]
  N215[infrastructure/storage/factory.ts]
  N216[infrastructure/storage/local.ts]
  N217[infrastructure/storage/schema.ts]
  N218[npm:node:stream]
  N219[infrastructure/storage/server-media-storage.ts]
  N220[infrastructure/utils/ffmpeg.ts]
  N221[apps/server/node_modules/fluent-ffmpeg/index.js]
  N222[infrastructure/utils/stream-utils.ts]
  N223[infrastructure/events/realtime-event-bus.ts]
  N224[npm:node:events]
  N225[infrastructure/router/route-types.ts]
  N226[apps/server/node_modules/@tanstack/solid-query/build/index.cjs]
  N227[infrastructure/server-route-bootstrap.ts]
  N228[infrastructure/services/author-service.ts]
  N229[npm:@solid-imager/application/services/author-service]
  N230[infrastructure/services/backup-service.ts]
  N231[npm:node:stream/promises]
  N232[infrastructure/services/bulk-operation-service.ts]
  N233[infrastructure/services/category-service.ts]
  N234[npm:@solid-imager/application/services/category-service]
  N235[npm:~/infrastructure/repositories/category-repository]
  N236[infrastructure/services/ccip-vector-service.ts]
  N237[npm:@solid-imager/application/ports/media-service]
  N238[npm:@solid-imager/application/services/ccip-vector-service]
  N239[npm:~/infrastructure/ai/postgres-ccip-vector-store]
  N240[npm:~/infrastructure/services/tagging-service]
  N241[infrastructure/services/collection-service.ts]
  N242[npm:@solid-imager/application/services/collection-service]
  N243[npm:~/infrastructure/repositories/collection-repository]
  N244[infrastructure/services/directory-service.ts]
  N245[npm:~/infrastructure/services/media-source-service]
  N246[npm:~/infrastructure/storage/factory]
  N247[infrastructure/services/directory-sync-service.ts]
  N248[infrastructure/services/ip-service.ts]
  N249[npm:@solid-imager/application/services/ip-service]
  N250[npm:~/infrastructure/repositories/ip-repository]
  N251[infrastructure/services/job-dispatch-service.ts]
  N252[infrastructure/services/job-transfer-storage.ts]
  N253[infrastructure/services/maintenance-service.ts]
  N254[infrastructure/services/media-processing-service.ts]
  N255[npm:@solid-imager/core/domain/interfaces/transaction-manager]
  N256[infrastructure/services/preset-service.ts]
  N257[apps/server/node_modules/@solid-imager/application/src/index.ts]
  N258[npm:@solid-imager/application/services/preset-service]
  N259[npm:~/infrastructure/repositories/preset-repository]
  N260[infrastructure/services/project-service.ts]
  N261[npm:@solid-imager/application/services/project-service]
  N262[npm:~/infrastructure/repositories/project-repository]
  N263[infrastructure/services/search-service.ts]
  N264[npm:@solid-imager/application/services/search-service]
  N265[infrastructure/services/server-config-service.ts]
  N266[npm:node:util]
  N267[infrastructure/services/source-transfer-job-service.ts]
  N268[infrastructure/services/tag-service.ts]
  N269[npm:@solid-imager/application/services/tag-service]
  N270[infrastructure/services/tagging-service.ts]
  N271[npm:@solid-imager/application/services/tagging-service]
  N272[infrastructure/services/thumbnail-service.ts]
  N273[npm:@solid-imager/core/domain/thumbnails/schemas]
  N274[infrastructure/services/user-service.ts]
  N275[npm:@solid-imager/application/services/user-service]
  N276[npm:~/infrastructure/repositories/user-repository]
  N277[infrastructure/services/search-snapshot-service.ts]
  N278[npm:@solid-imager/application/services/search-snapshot-service]
  N279[npm:~/infrastructure/repositories/search-snapshot-repository]
  N280[routes/$.tsx]
  N281[npm:@solid-imager/ui/screens/not-found-screen]
  N282[apps/server/node_modules/@tanstack/solid-router/dist/cjs/index.cjs]
  N283[routes/__root.tsx]
  N284[npm:@solid-imager/ui/layouts/app-shell]
  N285[npm:@solid-imager/ui/router-status]
  N286[npm:@solid-imager/ui/toast]
  N287[routes/about.tsx]
  N288[npm:@solid-imager/ui/counter]
  N289[routes/api/rpc.$.ts]
  N290[npm:@orpc/server/fetch]
  N291[npm:@orpc/server/plugins]
  N292[npm:~/infrastructure/api/rpc-response-headers]
  N293[npm:~/infrastructure/router/route-types]
  N294[npm:~/infrastructure/server-route-bootstrap]
  N295[routes/api/sources.$mediaSourceId.$mediaId.ts]
  N296[npm:@solid-imager/core/domain/media/utils/media-type-utils]
  N297[routes/api/jobs.$jobId.artifact.ts]
  N298[routes/api/sources.$mediaSourceId.thumbnail.$mediaId.ts]
  N299[routes/config.tsx]
  N300[npm:@solid-imager/ui/query-options]
  N301[npm:@solid-imager/ui/query-state]
  N302[npm:@solid-imager/ui/screens/legacy-config-state-screen]
  N303[npm:~/infrastructure/api-clients/queries]
  N304[routes/v2/$.tsx]
  N305[npm:@solid-imager/ui/button]
  N306[npm:@solid-imager/ui/v2/icons]
  N307[routes/v2/about.tsx]
  N308[npm:@solid-imager/ui/badge]
  N309[routes/v2/config.tsx]
  N310[npm:@solid-imager/ui/screens/v2-config-state-screen]
  N311[routes/v2/index.tsx]
  N312[routes/v2/jobs.tsx]
  N313[npm:@solid-imager/core/domain/jobs/schemas]
  N314[npm:@solid-imager/ui/hooks/use-job-events]
  N315[npm:@solid-imager/ui/screens/v2-jobs-screen]
  N316[routes/v2/manager.tsx]
  N317[npm:@solid-imager/ui/hooks/use-manager-page]
  N318[npm:@solid-imager/ui/screens/v2-manager/types]
  N319[npm:@solid-imager/ui/screens/v2-manager-screen]
  N320[npm:~/hooks/use-batch-job-events]
  N321[routes/v2/media-context.ts]
  N322[routes/v2/route.tsx]
  N323[apps/server/node_modules/solid-js/types/index.d.ts]
  N324[npm:~/components/api-activity-indicator]
  N325[npm:~/components/v2/v2-app-shell]
  N326[routes/v2/search.tsx]
  N327[npm:@solid-imager/ui/search-history-route]
  N328[routes/v2/sources/$mediaSourceId/$mediaId/index.tsx]
  N329[npm:@solid-imager/ui/screens/v2-media-detail-screen]
  N330[routes/v2/sources/$mediaSourceId/index.tsx]
  N331[npm:~/routes/sources/$mediaSourceId/components/v2-source-media-page]
  N332[routes/v2/components/v2-search-content.tsx]
  N333[npm:@solid-imager/ui/hooks/use-current-search-persistence]
  N334[npm:@solid-imager/ui/hooks/use-search-history-persistence]
  N335[npm:@solid-imager/ui/hooks/use-search-page]
  N336[npm:@solid-imager/ui/preset-client]
  N337[npm:@solid-imager/ui/screens/v2-search-screen]
  N338[npm:@solid-imager/ui/search-history-client]
  N339[npm:~/components/media/thumbnail-image]
  N340[npm:~/components/media/v2-media-grid-item]
  N341[npm:~/hooks/use-media-source-events]
  N342[npm:~/infrastructure/api/clients/preset-client]
  N343[npm:~/infrastructure/api/clients/search-history-client]
  N344[routes/docs/swagger/index.tsx]
  N345[routes/index.tsx]
  N346[routes/manager.tsx]
  N347[npm:@solid-imager/ui/screens/manager-screen]
  N348[routes/search.tsx]
  N349[npm:@solid-imager/ui/screens/search-screen]
  N350[npm:~/components/media/legacy-media-grid-item]
  N351[routes/sources/$mediaSourceId/$mediaId/index.tsx]
  N352[npm:@solid-imager/ui/screens/legacy-media-detail-screen]
  N353[routes/sources/$mediaSourceId/components/source-media-page.tsx]
  N354[npm:@solid-imager/ui/screens/source-media-screen.types]
  N355[npm:@solid-imager/ui/source-media-page]
  N356[routes/sources/$mediaSourceId/components/legacy-source-media-page.tsx]
  N357[npm:@solid-imager/ui/screens/source-media-screen]
  N358[npm:~/components/upload-media-modal]
  N359[routes/sources/$mediaSourceId/components/v2-source-media-page.tsx]
  N360[npm:@solid-imager/ui/screens/v2-source-media-screen]
  N361[npm:~/components/v2-upload-media-modal]
  N362[npm:~/routes/v2/media-context]
  N363[routes/sources/$mediaSourceId/index.tsx]
  N364[routes/sources/index.tsx]
  N365[npm:@solid-imager/ui/hooks/use-sources-events]
  N366[npm:@solid-imager/ui/hooks/use-sources-page]
  N367[npm:@solid-imager/ui/legacy-source-form-modal]
  N368[npm:@solid-imager/ui/screens/sources-screen]
  N369[npm:@solid-imager/ui/source-card]
  N370[npm:@solid-imager/ui/source-delete-modal]
  N371[routes/design-lab.tsx]
  N372[npm:@solid-imager/ui/screens/design-concept-screen]
  N0 --> N1
  N0 --> N2
  N0 --> N3
  N0 --> N4
  N0 --> N5
  N0 --> N6
  N7 --> N4
  N7 --> N8
  N9 --> N10
  N9 --> N11
  N9 --> N12
  N13 --> N14
  N13 --> N3
  N13 --> N5
  N13 --> N15
  N13 --> N16
  N13 --> N17
  N18 --> N12
  N19 --> N20
  N19 --> N12
  N21 --> N12
  N22 --> N12
  N23 --> N12
  N23 --> N24
  N25 --> N12
  N26 --> N27
  N24 --> N20
  N24 --> N12
  N28 --> N3
  N28 --> N29
  N28 --> N11
  N28 --> N12
  N30 --> N12
  N31 --> N32
  N31 --> N12
  N33 --> N34
  N33 --> N12
  N35 --> N1
  N35 --> N2
  N35 --> N14
  N36 --> N14
  N36 --> N37
  N36 --> N38
  N39 --> N14
  N39 --> N40
  N39 --> N41
  N42 --> N14
  N42 --> N43
  N42 --> N44
  N42 --> N45
  N46 --> N14
  N46 --> N47
  N46 --> N48
  N49 --> N14
  N49 --> N50
  N49 --> N51
  N52 --> N14
  N52 --> N53
  N52 --> N54
  N55 --> N14
  N55 --> N56
  N55 --> N20
  N55 --> N57
  N55 --> N58
  N55 --> N11
  N55 --> N59
  N55 --> N60
  N55 --> N61
  N55 --> N54
  N55 --> N62
  N63 --> N14
  N63 --> N64
  N63 --> N65
  N63 --> N45
  N66 --> N14
  N66 --> N67
  N66 --> N68
  N66 --> N69
  N66 --> N70
  N66 --> N71
  N66 --> N72
  N66 --> N73
  N74 --> N14
  N74 --> N75
  N74 --> N76
  N77 --> N14
  N77 --> N78
  N77 --> N79
  N77 --> N45
  N80 --> N14
  N81 --> N14
  N81 --> N82
  N81 --> N83
  N84 --> N14
  N84 --> N85
  N84 --> N86
  N87 --> N14
  N87 --> N88
  N89 --> N14
  N89 --> N90
  N45 --> N58
  N45 --> N59
  N91 --> N14
  N91 --> N92
  N91 --> N93
  N94 --> N95
  N94 --> N96
  N94 --> N97
  N94 --> N98
  N94 --> N99
  N94 --> N100
  N101 --> N14
  N101 --> N5
  N101 --> N102
  N101 --> N103
  N101 --> N104
  N101 --> N105
  N101 --> N106
  N101 --> N107
  N101 --> N108
  N101 --> N109
  N101 --> N110
  N101 --> N111
  N101 --> N112
  N101 --> N113
  N101 --> N114
  N101 --> N115
  N101 --> N116
  N101 --> N117
  N101 --> N118
  N101 --> N119
  N120 --> N121
  N120 --> N122
  N120 --> N61
  N120 --> N123
  N120 --> N124
  N120 --> N125
  N126 --> N127
  N126 --> N128
  N126 --> N60
  N129 --> N130
  N129 --> N131
  N129 --> N132
  N129 --> N133
  N134 --> N58
  N134 --> N135
  N136 --> N137
  N136 --> N135
  N138 --> N2
  N138 --> N130
  N138 --> N139
  N138 --> N140
  N138 --> N131
  N138 --> N70
  N138 --> N133
  N138 --> N141
  N133 --> N130
  N133 --> N142
  N143 --> N96
  N143 --> N144
  N145 --> N96
  N145 --> N1
  N145 --> N2
  N146 --> N4
  N147 --> N2
  N147 --> N61
  N147 --> N148
  N147 --> N149
  N147 --> N70
  N147 --> N150
  N147 --> N151
  N147 --> N48
  N147 --> N72
  N147 --> N152
  N147 --> N153
  N147 --> N154
  N155 --> N156
  N157 --> N4
  N157 --> N158
  N157 --> N60
  N157 --> N61
  N157 --> N70
  N159 --> N10
  N159 --> N58
  N159 --> N11
  N159 --> N59
  N160 --> N161
  N160 --> N162
  N163 --> N96
  N163 --> N2
  N163 --> N10
  N164 --> N2
  N164 --> N165
  N164 --> N61
  N164 --> N70
  N166 --> N167
  N168 --> N169
  N170 --> N171
  N170 --> N172
  N170 --> N173
  N174 --> N175
  N174 --> N176
  N174 --> N173
  N177 --> N178
  N177 --> N179
  N177 --> N173
  N180 --> N181
  N180 --> N182
  N180 --> N173
  N183 --> N184
  N183 --> N185
  N183 --> N173
  N186 --> N187
  N186 --> N188
  N186 --> N173
  N189 --> N97
  N189 --> N190
  N189 --> N173
  N191 --> N192
  N191 --> N173
  N193 --> N194
  N193 --> N195
  N193 --> N192
  N193 --> N173
  N193 --> N70
  N193 --> N196
  N193 --> N162
  N197 --> N198
  N197 --> N199
  N197 --> N173
  N200 --> N201
  N200 --> N202
  N200 --> N173
  N203 --> N204
  N203 --> N205
  N203 --> N173
  N206 --> N207
  N206 --> N208
  N206 --> N173
  N209 --> N210
  N209 --> N211
  N209 --> N173
  N212 --> N213
  N212 --> N214
  N212 --> N173
  N215 --> N29
  N215 --> N216
  N215 --> N217
  N216 --> N95
  N216 --> N96
  N216 --> N2
  N216 --> N29
  N216 --> N217
  N217 --> N95
  N217 --> N218
  N219 --> N96
  N219 --> N2
  N220 --> N221
  N220 --> N70
  N222 --> N218
  N223 --> N224
  N225 --> N226
  N227 --> N120
  N228 --> N229
  N228 --> N196
  N230 --> N95
  N230 --> N96
  N230 --> N2
  N230 --> N218
  N230 --> N231
  N232 --> N20
  N232 --> N149
  N232 --> N70
  N232 --> N48
  N233 --> N234
  N233 --> N235
  N236 --> N237
  N236 --> N238
  N236 --> N239
  N236 --> N59
  N236 --> N48
  N236 --> N240
  N241 --> N242
  N241 --> N243
  N244 --> N245
  N244 --> N246
  N247 --> N96
  N247 --> N2
  N247 --> N29
  N247 --> N61
  N247 --> N149
  N247 --> N70
  N247 --> N150
  N247 --> N151
  N247 --> N48
  N247 --> N72
  N247 --> N153
  N248 --> N249
  N248 --> N250
  N251 --> N237
  N251 --> N97
  N251 --> N61
  N252 --> N95
  N252 --> N96
  N252 --> N2
  N252 --> N231
  N252 --> N97
  N252 --> N100
  N253 --> N96
  N253 --> N2
  N253 --> N194
  N253 --> N204
  N253 --> N158
  N253 --> N149
  N253 --> N70
  N254 --> N255
  N254 --> N20
  N254 --> N97
  N254 --> N48
  N256 --> N257
  N256 --> N258
  N256 --> N198
  N256 --> N259
  N260 --> N261
  N260 --> N262
  N263 --> N264
  N263 --> N48
  N265 --> N95
  N265 --> N96
  N265 --> N2
  N265 --> N266
  N265 --> N144
  N267 --> N95
  N267 --> N96
  N267 --> N2
  N267 --> N231
  N268 --> N269
  N268 --> N162
  N270 --> N271
  N270 --> N61
  N270 --> N70
  N270 --> N48
  N272 --> N273
  N274 --> N275
  N274 --> N276
  N277 --> N257
  N277 --> N278
  N277 --> N213
  N277 --> N279
  N280 --> N281
  N280 --> N282
  N283 --> N284
  N283 --> N285
  N283 --> N286
  N283 --> N226
  N287 --> N288
  N287 --> N282
  N289 --> N290
  N289 --> N291
  N289 --> N282
  N289 --> N17
  N289 --> N292
  N289 --> N70
  N289 --> N293
  N289 --> N294
  N295 --> N2
  N295 --> N296
  N295 --> N29
  N295 --> N282
  N295 --> N293
  N295 --> N294
  N295 --> N48
  N297 --> N282
  N298 --> N273
  N298 --> N282
  N299 --> N300
  N299 --> N301
  N299 --> N285
  N299 --> N302
  N299 --> N226
  N299 --> N282
  N299 --> N12
  N299 --> N303
  N299 --> N293
  N304 --> N305
  N304 --> N306
  N304 --> N282
  N307 --> N308
  N307 --> N305
  N309 --> N300
  N309 --> N301
  N309 --> N310
  N309 --> N226
  N309 --> N282
  N309 --> N12
  N309 --> N303
  N311 --> N282
  N312 --> N313
  N312 --> N314
  N312 --> N300
  N312 --> N301
  N312 --> N315
  N312 --> N286
  N312 --> N226
  N312 --> N282
  N312 --> N12
  N312 --> N303
  N316 --> N317
  N316 --> N300
  N316 --> N318
  N316 --> N319
  N316 --> N286
  N316 --> N226
  N316 --> N282
  N316 --> N320
  N321 --> N20
  N322 --> N285
  N322 --> N282
  N322 --> N323
  N322 --> N324
  N322 --> N325
  N326 --> N327
  N326 --> N282
  N328 --> N20
  N328 --> N305
  N328 --> N329
  N330 --> N327
  N330 --> N282
  N330 --> N331
  N332 --> N333
  N332 --> N334
  N332 --> N335
  N332 --> N336
  N332 --> N337
  N332 --> N338
  N332 --> N282
  N332 --> N339
  N332 --> N340
  N332 --> N341
  N332 --> N342
  N332 --> N343
  N344 --> N282
  N345 --> N288
  N345 --> N282
  N346 --> N317
  N346 --> N285
  N346 --> N347
  N346 --> N226
  N346 --> N282
  N346 --> N323
  N346 --> N320
  N348 --> N305
  N348 --> N333
  N348 --> N334
  N348 --> N335
  N348 --> N336
  N348 --> N285
  N348 --> N349
  N348 --> N338
  N348 --> N327
  N348 --> N282
  N348 --> N323
  N348 --> N350
  N348 --> N341
  N348 --> N342
  N348 --> N343
  N351 --> N285
  N351 --> N352
  N353 --> N20
  N353 --> N305
  N353 --> N333
  N353 --> N336
  N353 --> N300
  N353 --> N285
  N353 --> N354
  N353 --> N338
  N353 --> N355
  N353 --> N226
  N353 --> N282
  N356 --> N357
  N356 --> N338
  N356 --> N323
  N356 --> N350
  N356 --> N358
  N356 --> N343
  N356 --> N353
  N359 --> N360
  N359 --> N338
  N359 --> N282
  N359 --> N323
  N359 --> N339
  N359 --> N340
  N359 --> N361
  N359 --> N343
  N359 --> N362
  N363 --> N285
  N363 --> N327
  N363 --> N282
  N363 --> N323
  N364 --> N29
  N364 --> N365
  N364 --> N366
  N364 --> N367
  N364 --> N301
  N364 --> N285
  N364 --> N368
  N364 --> N369
  N364 --> N370
  N364 --> N226
  N364 --> N282
  N364 --> N341
  N364 --> N303
  N371 --> N372
  N371 --> N282
```
