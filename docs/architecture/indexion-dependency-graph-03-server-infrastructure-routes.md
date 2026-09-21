# solid-imager detail 03 - server infrastructure and routes

## Diagram 1

```mermaid
graph LR
  N0["apps/server/src/infrastructure/ai/rust-ai-client.ts"]
  N1["npm:node:os"]
  N2["npm:node:path"]
  N3["apps/server/node_modules/@solid-imager/client/src/index.ts"]
  N4["npm:@solid-imager/core/domain/config/config-schema"]
  N5["npm:@solid-imager/core/domain/contract"]
  N6["npm:@solid-imager/core/domain/interfaces/ai-client"]
  N7["apps/server/src/infrastructure/ai/inference-options.ts"]
  N8["node_modules/dghs-imgutils-rs/index.js"]
  N9["apps/server/src/infrastructure/api-clients/ai-api.ts"]
  N10["npm:@solid-imager/core/domain/tagging/schemas"]
  N11["node_modules/zod/index.d.cts"]
  N12["npm:~/infrastructure/api-clients/orpc-client"]
  N13["apps/server/src/infrastructure/api-clients/orpc-client.ts"]
  N14["node_modules/@orpc/server/dist/index.d.mts"]
  N15["npm:@tanstack/solid-start"]
  N16["npm:@tanstack/solid-start/server"]
  N17["npm:~/infrastructure/api/app-router"]
  N18["apps/server/src/infrastructure/api-clients/characters-api.ts"]
  N19["apps/server/src/infrastructure/api-clients/downloads-api.ts"]
  N20["npm:@solid-imager/core/domain/media/schemas"]
  N21["apps/server/src/infrastructure/api-clients/fetch-url-api.ts"]
  N22["apps/server/src/infrastructure/api-clients/ips-api.ts"]
  N23["apps/server/src/infrastructure/api-clients/media-api.ts"]
  N24["apps/server/src/infrastructure/api-clients/search-api.ts"]
  N25["apps/server/src/infrastructure/api-clients/projects-api.ts"]
  N26["apps/server/src/infrastructure/api-clients/queries/index.ts"]
  N27["node_modules/@orpc/solid-query/dist/index.d.mts"]
  N28["npm:@solid-imager/core/domain/jobs/schemas"]
  N29["apps/server/src/infrastructure/api-clients/sources-api.ts"]
  N30["npm:@solid-imager/core/domain/sources/schemas"]
  N31["apps/server/src/infrastructure/api-clients/thumbnails.ts"]
  N32["apps/server/src/infrastructure/api/clients/preset-client.ts"]
  N33["npm:@solid-imager/core/domain/contract/presets-client"]
  N34["apps/server/src/infrastructure/api/clients/search-history-client.ts"]
  N35["npm:@solid-imager/core/domain/contract/search-snapshots-client"]
  N36["apps/server/src/infrastructure/api/routers/ai-router.ts"]
  N37["apps/server/src/infrastructure/api/routers/authors-router.ts"]
  N38["npm:@solid-imager/core/domain/contract/authors.contract"]
  N39["npm:~/infrastructure/repositories/authors-repository"]
  N40["apps/server/src/infrastructure/api/routers/categories-router.ts"]
  N41["npm:@solid-imager/core/domain/contract/categories.contract"]
  N42["npm:~/infrastructure/services/category-service"]
  N43["apps/server/src/infrastructure/api/routers/characters-router.ts"]
  N44["npm:@solid-imager/core/domain/contract/characters.contract"]
  N45["npm:~/infrastructure/services/character-service"]
  N46["apps/server/src/infrastructure/api/routers/entity-media-counts.ts"]
  N47["apps/server/src/infrastructure/api/routers/config-router.ts"]
  N48["npm:@solid-imager/core/domain/contract/config.contract"]
  N49["npm:~/infrastructure/service-registry"]
  N50["apps/server/src/infrastructure/api/routers/directories-router.ts"]
  N51["npm:@solid-imager/core/domain/contract/directories.contract"]
  N52["npm:~/infrastructure/services/directory-service"]
  N53["apps/server/src/infrastructure/api/routers/downloads-router.ts"]
  N54["npm:@solid-imager/core/domain/contract/downloads.contract"]
  N55["npm:~/infrastructure/jobs/download-jobs"]
  N56["apps/server/src/infrastructure/api/routers/imports-router.ts"]
  N57["npm:@solid-imager/core/domain/contract/imports.contract"]
  N58["npm:@solid-imager/core/domain/sources/events"]
  N59["node_modules/drizzle-orm/index.d.ts"]
  N60["npm:~/infrastructure/db"]
  N61["npm:~/infrastructure/db/schema"]
  N62["npm:~/infrastructure/events/realtime-event-bus"]
  N63["npm:~/infrastructure/services/backup-service"]
  N64["apps/server/src/infrastructure/api/routers/ips-router.ts"]
  N65["npm:@solid-imager/core/domain/contract/ips.contract"]
  N66["npm:~/infrastructure/services/ip-service"]
  N67["apps/server/src/infrastructure/api/routers/media-router.ts"]
  N68["npm:@solid-imager/core/domain/contract/media.contract"]
  N69["npm:@solid-imager/core/domain/errors"]
  N70["npm:@solid-imager/core/utils/async-pool"]
  N71["npm:~/infrastructure/logger"]
  N72["npm:~/infrastructure/services/bulk-operation-service"]
  N73["npm:~/infrastructure/services/ccip-vector-service"]
  N74["npm:~/infrastructure/services/media-service"]
  N75["apps/server/src/infrastructure/api/routers/presets-router.ts"]
  N76["npm:@solid-imager/core/domain/contract/presets.contract"]
  N77["npm:~/infrastructure/services/preset-service"]
  N78["apps/server/src/infrastructure/api/routers/projects-router.ts"]
  N79["npm:@solid-imager/core/domain/contract/projects.contract"]
  N80["npm:~/infrastructure/services/project-service"]
  N81["apps/server/src/infrastructure/api/routers/sources-router.ts"]
  N82["npm:node:crypto"]
  N83["apps/server/src/infrastructure/api/routers/tags-router.ts"]
  N84["npm:@solid-imager/core/domain/contract/tags.contract"]
  N85["npm:~/infrastructure/services/tag-service"]
  N86["apps/server/src/infrastructure/api/routers/thumbnails-router.ts"]
  N87["npm:@solid-imager/core/domain/contract/thumbnails.contract"]
  N88["npm:~/infrastructure/services/thumbnail-service"]
  N89["apps/server/src/infrastructure/api/routers/utils-router.ts"]
  N90["npm:@solid-imager/core/domain/contract/utils.contract"]
  N91["apps/server/src/infrastructure/api/routers/jobs-router.ts"]
  N92["npm:@solid-imager/core/domain/contract/jobs.contract"]
  N93["apps/server/src/infrastructure/api/routers/search-snapshots-router.ts"]
  N94["npm:@solid-imager/core/domain/contract/search-snapshots.contract"]
  N95["npm:@solid-imager/core/domain/search/history"]
  N96["npm:~/infrastructure/services/search-snapshot-service"]
  N97["apps/server/src/infrastructure/api/job-artifact.ts"]
  N98["npm:node:fs"]
  N99["npm:node:fs/promises"]
  N100["npm:@solid-imager/core/domain/repositories/job-repository"]
  N101["npm:~/infrastructure/repositories/job-repository"]
  N102["npm:~/infrastructure/services/job-transfer-storage"]
  N103["npm:~/infrastructure/utils/stream-utils"]
  N104["apps/server/src/infrastructure/api/app-router.ts"]
  N105["node_modules/zod/compile.d.ts"]
  N106["npm:~/infrastructure/api/routers/ai-router"]
  N107["npm:~/infrastructure/api/routers/authors-router"]
  N108["npm:~/infrastructure/api/routers/categories-router"]
  N109["npm:~/infrastructure/api/routers/characters-router"]
  N110["npm:~/infrastructure/api/routers/config-router"]
  N111["npm:~/infrastructure/api/routers/directories-router"]
  N112["npm:~/infrastructure/api/routers/downloads-router"]
  N113["npm:~/infrastructure/api/routers/imports-router"]
  N114["npm:~/infrastructure/api/routers/ips-router"]
  N115["npm:~/infrastructure/api/routers/jobs-router"]
  N116["npm:~/infrastructure/api/routers/media-router"]
  N117["npm:~/infrastructure/api/routers/presets-router"]
  N118["npm:~/infrastructure/api/routers/projects-router"]
  N119["npm:~/infrastructure/api/routers/search-snapshots-router"]
  N120["npm:~/infrastructure/api/routers/sources-router"]
  N121["npm:~/infrastructure/api/routers/tags-router"]
  N122["npm:~/infrastructure/api/routers/thumbnails-router"]
  N123["npm:~/infrastructure/api/routers/utils-router"]
  N124["apps/server/src/infrastructure/bootstrap.ts"]
  N125["npm:~/infrastructure/ai/rust-ai-client"]
  N126["npm:~/infrastructure/db/transaction-manager"]
  N127["npm:~/infrastructure/file-system/node-file-system"]
  N128["npm:~/infrastructure/jobs/download-rate-limiter"]
  N129["npm:~/infrastructure/jobs/job-worker"]
  N130["apps/server/src/infrastructure/db/__mocks__/index.ts"]
  N131["npm:uuid"]
  N132["node_modules/vitest/dist/index.js"]
  N133["apps/server/src/infrastructure/db/connection.ts"]
  N134["node_modules/@electric-sql/pglite/dist/index.cjs"]
  N135["npm:bun"]
  N136["node_modules/pg/esm/index.mjs"]
  N137["npm:~/config/database"]
  N138["apps/server/src/infrastructure/db/pglite.ts"]
  N139["apps/server/src/infrastructure/db/postgres-driver.ts"]
  N140["apps/server/src/infrastructure/db/data-migration.ts"]
  N141["npm:~/infrastructure/db/index"]
  N142["apps/server/src/infrastructure/db/executor.ts"]
  N143["npm:@solid-imager/db/types"]
  N144["apps/server/src/infrastructure/db/index.ts"]
  N145["node_modules/drizzle-orm/bun-sql/index.d.ts"]
  N146["node_modules/drizzle-orm/node-postgres/index.d.ts"]
  N147["node_modules/drizzle-orm/pglite/index.d.ts"]
  N148["apps/server/src/infrastructure/db/schema.ts"]
  N149["node_modules/@electric-sql/pglite-pgvector/dist/index.cjs"]
  N150["apps/server/src/infrastructure/file-system/node-file-system.ts"]
  N151["apps/server/node_modules/@solid-imager/core/src/index.ts"]
  N152["apps/server/src/infrastructure/jobs/download-jobs.ts"]
  N153["apps/server/src/infrastructure/jobs/download-rate-limiter.ts"]
  N154["apps/server/src/infrastructure/jobs/file-watcher-service.ts"]
  N155["npm:~/infrastructure/jobs/file-watcher-manager"]
  N156["npm:~/infrastructure/jobs/thumbnails"]
  N157["npm:~/infrastructure/repositories/media-repository"]
  N158["npm:~/infrastructure/repositories/source-repository"]
  N159["npm:~/infrastructure/services/directory-sync-service"]
  N160["npm:~/infrastructure/services/media-processing-service"]
  N161["npm:~/infrastructure/storage/server-media-storage"]
  N162["apps/server/src/infrastructure/jobs/ccip-jobs.ts"]
  N163["npm:@solid-imager/application/ports/ccip-vector-store"]
  N164["apps/server/src/infrastructure/jobs/job-worker.ts"]
  N165["npm:~/domain/repositories/job-repository"]
  N166["apps/server/src/infrastructure/jobs/tagging-jobs.ts"]
  N167["apps/server/src/infrastructure/jobs/tag-extraction.ts"]
  N168["npm:~/infrastructure/processing/image-processor"]
  N169["npm:~/infrastructure/repositories/tag-repository"]
  N170["apps/server/src/infrastructure/jobs/thumbnails.ts"]
  N171["apps/server/src/infrastructure/jobs/file-watcher-manager.ts"]
  N172["node_modules/chokidar/index.js"]
  N173["apps/server/src/infrastructure/logger.ts"]
  N174["node_modules/pino/pino.js"]
  N175["apps/server/src/infrastructure/processing/image-processor.ts"]
  N176["node_modules/sharp/dist/index.cjs"]
  N177["apps/server/src/infrastructure/processing/bun-image.ts"]
  N178["apps/server/src/infrastructure/repositories/author-repository.ts"]
  N179["npm:@solid-imager/core/domain/repositories/author-repository"]
  N180["npm:@solid-imager/db/repositories/author-repository"]
  N181["npm:~/infrastructure/db/executor"]
  N182["apps/server/src/infrastructure/repositories/authors-repository.ts"]
  N183["npm:@solid-imager/core/domain/repositories/authors-repository"]
  N184["npm:@solid-imager/db/repositories/authors-repository"]
  N185["apps/server/src/infrastructure/repositories/category-repository.ts"]
  N186["npm:@solid-imager/core/domain/repositories/category-repository"]
  N187["npm:@solid-imager/db/repositories/category-repository"]
  N188["apps/server/src/infrastructure/repositories/character-repository.ts"]
  N189["npm:@solid-imager/core/domain/repositories/character-repository"]
  N190["npm:@solid-imager/db/repositories/character-repository"]
  N191["apps/server/src/infrastructure/repositories/collection-repository.ts"]
  N192["npm:@solid-imager/core/domain/repositories/collection-repository"]
  N193["npm:@solid-imager/db/repositories/collection-repository"]
  N194["apps/server/src/infrastructure/repositories/ip-repository.ts"]
  N195["npm:@solid-imager/core/domain/repositories/ip-repository"]
  N196["npm:@solid-imager/db/repositories/ip-repository"]
  N197["apps/server/src/infrastructure/repositories/job-repository.ts"]
  N198["apps/server/src/infrastructure/repositories/media-repository-utils.ts"]
  N199["npm:@solid-imager/db/repositories/media-repository-utils"]
  N200["apps/server/src/infrastructure/repositories/media-repository.ts"]
  N201["npm:@solid-imager/core/domain/repositories/media-repository"]
  N202["npm:@solid-imager/db/repositories/media-repository"]
  N203["npm:~/infrastructure/repositories/author-repository"]
  N204["apps/server/src/infrastructure/repositories/preset-repository.ts"]
  N205["npm:@solid-imager/core/domain/repositories/preset-repository"]
  N206["npm:@solid-imager/db/repositories/preset-repository"]
  N207["apps/server/src/infrastructure/repositories/project-repository.ts"]
  N208["npm:@solid-imager/core/domain/repositories/project-repository"]
  N209["npm:@solid-imager/db/repositories/project-repository"]
  N210["apps/server/src/infrastructure/repositories/source-repository.ts"]
  N211["npm:@solid-imager/core/domain/repositories/source-repository"]
  N212["npm:@solid-imager/db/repositories/source-repository"]
  N213["apps/server/src/infrastructure/repositories/tag-repository.ts"]
  N214["npm:@solid-imager/core/domain/repositories/tag-repository"]
  N215["npm:@solid-imager/db/repositories/tag-repository"]
  N216["apps/server/src/infrastructure/repositories/user-repository.ts"]
  N217["npm:@solid-imager/core/domain/repositories/user-repository"]
  N218["npm:@solid-imager/db/repositories/user-repository"]
  N219["apps/server/src/infrastructure/repositories/search-snapshot-repository.ts"]
  N220["npm:@solid-imager/core/domain/repositories/search-snapshot-repository"]
  N221["npm:@solid-imager/db/repositories/search-snapshot-repository"]
  N222["apps/server/src/infrastructure/storage/factory.ts"]
  N223["apps/server/src/infrastructure/storage/local.ts"]
  N224["apps/server/src/infrastructure/storage/schema.ts"]
  N225["npm:node:stream"]
  N226["apps/server/src/infrastructure/storage/server-media-storage.ts"]
  N227["apps/server/src/infrastructure/utils/ffmpeg.ts"]
  N228["node_modules/fluent-ffmpeg/index.js"]
  N229["apps/server/src/infrastructure/utils/stream-utils.ts"]
  N230["apps/server/src/infrastructure/events/realtime-event-bus.ts"]
  N231["npm:node:events"]
  N232["apps/server/src/infrastructure/router/route-types.ts"]
  N233["node_modules/@tanstack/solid-query/build/index.cjs"]
  N234["apps/server/src/infrastructure/server-route-bootstrap.ts"]
  N235["apps/server/src/infrastructure/services/author-service.ts"]
  N236["npm:@solid-imager/application/services/author-service"]
  N237["apps/server/src/infrastructure/services/backup-service.ts"]
  N238["npm:node:stream/promises"]
  N239["apps/server/src/infrastructure/services/bulk-operation-service.ts"]
  N240["apps/server/src/infrastructure/services/category-service.ts"]
  N241["npm:@solid-imager/application/services/category-service"]
  N242["npm:~/infrastructure/repositories/category-repository"]
  N243["apps/server/src/infrastructure/services/ccip-vector-service.ts"]
  N244["npm:@solid-imager/application/ports/media-service"]
  N245["npm:@solid-imager/application/services/ccip-vector-service"]
  N246["npm:~/infrastructure/ai/postgres-ccip-vector-store"]
  N247["npm:~/infrastructure/services/tagging-service"]
  N248["apps/server/src/infrastructure/services/collection-service.ts"]
  N249["npm:@solid-imager/application/services/collection-service"]
  N250["npm:~/infrastructure/repositories/collection-repository"]
  N251["apps/server/src/infrastructure/services/directory-service.ts"]
  N252["npm:~/infrastructure/services/media-source-service"]
  N253["npm:~/infrastructure/storage/factory"]
  N254["apps/server/src/infrastructure/services/directory-sync-service.ts"]
  N255["apps/server/src/infrastructure/services/ip-service.ts"]
  N256["npm:@solid-imager/application/services/ip-service"]
  N257["npm:~/infrastructure/repositories/ip-repository"]
  N258["apps/server/src/infrastructure/services/job-dispatch-service.ts"]
  N259["apps/server/src/infrastructure/services/job-transfer-storage.ts"]
  N260["apps/server/src/infrastructure/services/maintenance-service.ts"]
  N261["apps/server/src/infrastructure/services/media-processing-service.ts"]
  N262["npm:@solid-imager/core/domain/interfaces/transaction-manager"]
  N263["apps/server/src/infrastructure/services/preset-service.ts"]
  N264["apps/server/node_modules/@solid-imager/application/src/index.ts"]
  N265["npm:@solid-imager/application/services/preset-service"]
  N266["npm:~/infrastructure/repositories/preset-repository"]
  N267["apps/server/src/infrastructure/services/project-service.ts"]
  N268["npm:@solid-imager/application/services/project-service"]
  N269["npm:~/infrastructure/repositories/project-repository"]
  N270["apps/server/src/infrastructure/services/search-service.ts"]
  N271["npm:@solid-imager/application/services/search-service"]
  N272["apps/server/src/infrastructure/services/search-snapshot-service.ts"]
  N273["npm:@solid-imager/application/services/search-snapshot-service"]
  N274["npm:~/infrastructure/repositories/search-snapshot-repository"]
  N275["apps/server/src/infrastructure/services/server-config-service.ts"]
  N276["npm:node:util"]
  N277["apps/server/src/infrastructure/services/source-transfer-job-service.ts"]
  N278["apps/server/src/infrastructure/services/tag-service.ts"]
  N279["npm:@solid-imager/application/services/tag-service"]
  N280["apps/server/src/infrastructure/services/tagging-service.ts"]
  N281["npm:@solid-imager/application/services/tagging-service"]
  N282["apps/server/src/infrastructure/services/thumbnail-service.ts"]
  N283["npm:@solid-imager/core/domain/thumbnails/schemas"]
  N284["apps/server/src/infrastructure/services/user-service.ts"]
  N285["npm:@solid-imager/application/services/user-service"]
  N286["npm:~/infrastructure/repositories/user-repository"]
  N287["apps/server/src/routes/$.tsx"]
  N288["node_modules/@tanstack/solid-router/dist/cjs/index.cjs"]
  N289["npm:~/components/route-compat"]
  N290["apps/server/src/routes/__root.tsx"]
  N291["npm:@solid-imager/ui/shortcuts/index"]
  N292["npm:@solid-imager/ui/toast"]
  N293["apps/server/src/routes/about.tsx"]
  N294["npm:~/components/pages/about-page"]
  N295["apps/server/src/routes/api/rpc.$.ts"]
  N296["npm:@orpc/server/fetch"]
  N297["npm:@orpc/server/plugins"]
  N298["npm:~/infrastructure/api/rpc-response-headers"]
  N299["npm:~/infrastructure/router/route-types"]
  N300["npm:~/infrastructure/server-route-bootstrap"]
  N301["apps/server/src/routes/api/sources.$mediaSourceId.$mediaId.ts"]
  N302["npm:@solid-imager/core/domain/media/utils/media-type-utils"]
  N303["apps/server/src/routes/api/jobs.$jobId.artifact.ts"]
  N304["apps/server/src/routes/api/sources.$mediaSourceId.thumbnail.$mediaId.ts"]
  N305["apps/server/src/routes/api/health.ts"]
  N306["apps/server/src/routes/config.tsx"]
  N307["npm:~/components/pages/config-page"]
  N308["apps/server/src/routes/jobs.tsx"]
  N309["npm:~/components/pages/jobs-page"]
  N310["apps/server/src/routes/docs/swagger/index.tsx"]
  N311["apps/server/src/routes/index.tsx"]
  N312["apps/server/src/routes/manager.tsx"]
  N313["npm:~/components/pages/manager-page"]
  N314["apps/server/src/routes/search.tsx"]
  N315["npm:@solid-imager/ui/search-history-route"]
  N316["apps/server/src/routes/sources/$mediaSourceId/$mediaId/index.tsx"]
  N317["npm:~/components/pages/media-detail-page"]
  N318["apps/server/src/routes/sources/$mediaSourceId/components/source-media-page.tsx"]
  N319["npm:@solid-imager/ui/search-history-client"]
  N320["npm:@solid-imager/ui/stores/search-store"]
  N321["node_modules/solid-js/types/index.d.ts"]
  N322["npm:~/components/media/media-context"]
  N323["npm:~/components/media/media-grid-item"]
  N324["npm:~/components/media/thumbnail-image"]
  N325["npm:~/components/upload-media-modal"]
  N326["npm:~/infrastructure/api/clients/search-history-client"]
  N327["apps/server/src/routes/sources/$mediaSourceId/components/source-media-controller.tsx"]
  N328["npm:@solid-imager/ui/button"]
  N329["apps/server/src/routes/sources/$mediaSourceId/index.tsx"]
  N330["apps/server/src/routes/sources/index.tsx"]
  N331["apps/server/src/routes/design-lab.tsx"]
  N332["npm:@solid-imager/ui/screens/design-concept-screen"]
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
  N26 --> N28
  N24 --> N20
  N24 --> N12
  N29 --> N3
  N29 --> N30
  N29 --> N11
  N29 --> N12
  N31 --> N12
  N32 --> N33
  N32 --> N12
  N34 --> N35
  N34 --> N12
  N36 --> N1
  N36 --> N2
  N36 --> N14
  N37 --> N14
  N37 --> N38
  N37 --> N39
  N40 --> N14
  N40 --> N41
  N40 --> N42
  N43 --> N14
  N43 --> N44
  N43 --> N45
  N43 --> N46
  N47 --> N14
  N47 --> N48
  N47 --> N49
  N50 --> N14
  N50 --> N51
  N50 --> N52
  N53 --> N14
  N53 --> N54
  N53 --> N55
  N56 --> N14
  N56 --> N57
  N56 --> N20
  N56 --> N58
  N56 --> N59
  N56 --> N11
  N56 --> N60
  N56 --> N61
  N56 --> N62
  N56 --> N55
  N56 --> N63
  N64 --> N14
  N64 --> N65
  N64 --> N66
  N64 --> N46
  N67 --> N14
  N67 --> N68
  N67 --> N69
  N67 --> N70
  N67 --> N71
  N67 --> N72
  N67 --> N73
  N67 --> N74
  N75 --> N14
  N75 --> N76
  N75 --> N77
  N78 --> N14
  N78 --> N79
  N78 --> N80
  N78 --> N46
  N81 --> N82
  N81 --> N14
  N83 --> N14
  N83 --> N84
  N83 --> N85
  N86 --> N14
  N86 --> N87
  N86 --> N88
  N89 --> N14
  N89 --> N90
  N91 --> N14
  N91 --> N92
  N46 --> N59
  N46 --> N60
  N93 --> N14
  N93 --> N94
  N93 --> N95
  N93 --> N96
  N97 --> N98
  N97 --> N99
  N97 --> N100
  N97 --> N101
  N97 --> N102
  N97 --> N103
  N104 --> N105
  N104 --> N14
  N104 --> N5
  N104 --> N106
  N104 --> N107
  N104 --> N108
  N104 --> N109
  N104 --> N110
  N104 --> N111
  N104 --> N112
  N104 --> N113
  N104 --> N114
  N104 --> N115
  N104 --> N116
  N104 --> N117
  N104 --> N118
  N104 --> N119
  N104 --> N120
  N104 --> N121
  N104 --> N122
  N104 --> N123
  N124 --> N125
  N124 --> N126
  N124 --> N62
  N124 --> N127
  N124 --> N128
  N124 --> N129
  N130 --> N131
  N130 --> N132
  N130 --> N61
  N133 --> N134
  N133 --> N135
  N133 --> N136
  N133 --> N137
  N133 --> N138
  N133 --> N139
  N140 --> N59
  N140 --> N141
  N142 --> N143
  N142 --> N141
  N144 --> N2
  N144 --> N134
  N144 --> N135
  N144 --> N145
  N144 --> N146
  N144 --> N147
  N144 --> N136
  N144 --> N71
  N144 --> N138
  N144 --> N139
  N144 --> N148
  N138 --> N134
  N138 --> N149
  N150 --> N99
  N150 --> N151
  N152 --> N99
  N152 --> N1
  N152 --> N2
  N153 --> N4
  N154 --> N2
  N154 --> N62
  N154 --> N155
  N154 --> N156
  N154 --> N71
  N154 --> N157
  N154 --> N158
  N154 --> N49
  N154 --> N73
  N154 --> N159
  N154 --> N160
  N154 --> N161
  N162 --> N163
  N164 --> N4
  N164 --> N165
  N164 --> N61
  N164 --> N62
  N164 --> N71
  N166 --> N10
  N166 --> N59
  N166 --> N11
  N166 --> N60
  N167 --> N168
  N167 --> N169
  N170 --> N99
  N170 --> N2
  N170 --> N10
  N171 --> N2
  N171 --> N172
  N171 --> N62
  N171 --> N71
  N173 --> N174
  N175 --> N176
  N177 --> N176
  N178 --> N179
  N178 --> N180
  N178 --> N181
  N182 --> N183
  N182 --> N184
  N182 --> N181
  N185 --> N186
  N185 --> N187
  N185 --> N181
  N188 --> N189
  N188 --> N190
  N188 --> N181
  N191 --> N192
  N191 --> N193
  N191 --> N181
  N194 --> N195
  N194 --> N196
  N194 --> N181
  N197 --> N100
  N198 --> N199
  N198 --> N181
  N200 --> N201
  N200 --> N202
  N200 --> N199
  N200 --> N181
  N200 --> N71
  N200 --> N203
  N200 --> N169
  N204 --> N205
  N204 --> N206
  N204 --> N181
  N207 --> N208
  N207 --> N209
  N207 --> N181
  N210 --> N211
  N210 --> N212
  N210 --> N181
  N213 --> N214
  N213 --> N215
  N213 --> N181
  N216 --> N217
  N216 --> N218
  N216 --> N181
  N219 --> N220
  N219 --> N221
  N219 --> N181
  N222 --> N30
  N222 --> N223
  N222 --> N224
  N223 --> N98
  N223 --> N99
  N223 --> N2
  N223 --> N30
  N223 --> N224
  N224 --> N98
  N224 --> N225
  N226 --> N99
  N226 --> N2
  N227 --> N228
  N227 --> N71
  N229 --> N225
  N230 --> N231
  N232 --> N233
  N234 --> N124
  N235 --> N236
  N235 --> N203
  N237 --> N98
  N237 --> N99
  N237 --> N2
  N237 --> N225
  N237 --> N238
  N239 --> N20
  N239 --> N156
  N239 --> N71
  N239 --> N49
  N240 --> N241
  N240 --> N242
  N243 --> N244
  N243 --> N245
  N243 --> N246
  N243 --> N60
  N243 --> N49
  N243 --> N247
  N248 --> N249
  N248 --> N250
  N251 --> N252
  N251 --> N253
  N254 --> N99
  N254 --> N2
  N254 --> N30
  N254 --> N62
  N254 --> N156
  N254 --> N71
  N254 --> N157
  N254 --> N158
  N254 --> N49
  N254 --> N73
  N254 --> N160
  N255 --> N256
  N255 --> N257
  N258 --> N244
  N258 --> N100
  N258 --> N62
  N259 --> N98
  N259 --> N99
  N259 --> N2
  N259 --> N238
  N259 --> N100
  N259 --> N103
  N260 --> N99
  N260 --> N2
  N260 --> N201
  N260 --> N211
  N260 --> N165
  N260 --> N156
  N260 --> N71
  N261 --> N262
  N261 --> N20
  N261 --> N100
  N261 --> N49
  N263 --> N264
  N263 --> N265
  N263 --> N205
  N263 --> N266
  N267 --> N268
  N267 --> N269
  N270 --> N271
  N270 --> N49
  N272 --> N264
  N272 --> N273
  N272 --> N220
  N272 --> N274
  N275 --> N98
  N275 --> N99
  N275 --> N2
  N275 --> N276
  N275 --> N151
  N277 --> N98
  N277 --> N99
  N277 --> N2
  N277 --> N238
  N278 --> N279
  N278 --> N169
  N280 --> N281
  N280 --> N62
  N280 --> N71
  N280 --> N49
  N282 --> N283
  N284 --> N285
  N284 --> N286
  N287 --> N288
  N287 --> N289
  N290 --> N291
  N290 --> N292
  N290 --> N233
  N293 --> N288
  N293 --> N294
  N295 --> N296
  N295 --> N297
  N295 --> N288
  N295 --> N17
  N295 --> N298
  N295 --> N71
  N295 --> N299
  N295 --> N300
  N301 --> N2
  N301 --> N302
  N301 --> N30
  N301 --> N288
  N301 --> N299
  N301 --> N300
  N301 --> N49
  N303 --> N288
  N304 --> N283
  N304 --> N288
  N305 --> N288
  N306 --> N288
  N306 --> N307
  N308 --> N288
  N308 --> N309
  N310 --> N288
  N311 --> N288
  N311 --> N289
  N312 --> N288
  N312 --> N313
  N314 --> N315
  N314 --> N288
  N316 --> N288
  N316 --> N317
  N318 --> N319
  N318 --> N320
  N318 --> N288
  N318 --> N321
  N318 --> N322
  N318 --> N323
  N318 --> N324
  N318 --> N325
  N318 --> N326
  N327 --> N20
  N327 --> N328
  N329 --> N315
  N329 --> N288
  N329 --> N318
  N330 --> N288
  N330 --> N289
  N331 --> N332
  N331 --> N288
```
