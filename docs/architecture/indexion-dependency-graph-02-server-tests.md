# solid-imager detail 02 - server tests

```mermaid
graph LR
  N0[api/categories/category-id-test.ts]
  N1[apps/server/node_modules/vitest/dist/index.js]
  N2[npm:~/infrastructure/db/schema]
  N3[api/categories/index.test.ts]
  N4[api/characters/character-id-test.ts]
  N5[api/ips/ip-id-test.ts]
  N6[api/media/add-media.test.ts]
  N7[npm:@solid-imager/core/domain/media/schemas]
  N8[apps/server/node_modules/zod/index.d.cts]
  N9[api/media/delete-media.test.ts]
  N10[npm:@solid-imager/core/domain/sources/schemas]
  N11[api/media/get-media.test.ts]
  N12[api/media/list-media.test.ts]
  N13[api/tags/index.test.ts]
  N14[api/tags/tag-id-test.ts]
  N15[e2e/app-nav.responsive.spec.ts]
  N16[apps/server/node_modules/@playwright/test/index.d.ts]
  N17[e2e/support/test.ts]
  N18[e2e/loading-recovery.spec.ts]
  N19[e2e/media-detail-manager-config.responsive.spec.ts]
  N20[e2e/realtime-preservation.spec.ts]
  N21[npm:node:crypto]
  N22[npm:node:fs/promises]
  N23[npm:node:path]
  N24[e2e/route-reload.spec.ts]
  N25[e2e/search-pro-dialog.responsive.spec.ts]
  N26[e2e/search-realtime-preservation.responsive.spec.ts]
  N27[e2e/search.responsive.spec.ts]
  N28[e2e/support/fixture.ts]
  N29[e2e/sources-source-media.responsive.spec.ts]
  N30[e2e/ui-components.gallery.spec.ts]
  N31[e2e/ui-gallery/index.html]
  N32[url:ja]
  N33[url:UTF-8]
  N34[url:viewport]
  N35[url:width=device-width, initial-scale=1.0]
  N36[url:root]
  N37[url:module]
  N38[url:src.tsx]
  N39[e2e/ui-gallery/src.tsx]
  N40[e2e/ui-gallery/vite.config.ts]
  N41[npm:node:url]
  N42[apps/server/node_modules/@tailwindcss/vite/dist/index.d.mts]
  N43[apps/server/node_modules/sharp/dist/index.cjs]
  N44[apps/server/node_modules/vite/dist/node/index.js]
  N45[apps/server/node_modules/vite-plugin-solid/dist/cjs/index.cjs]
  N46[e2e/v2-routes.responsive.spec.ts]
  N47[e2e/v2-scroll-restoration.spec.ts]
  N48[integration/backup/backup-service.test.ts]
  N49[apps/server/node_modules/drizzle-orm/index.d.ts]
  N50[npm:~/infrastructure/db]
  N51[integration/backup/performance.test.ts]
  N52[integration/backup/zip-backup.test.ts]
  N53[npm:node:fs]
  N54[npm:node:os]
  N55[npm:node:stream/promises]
  N56[integration/db/pglite-parity.test.ts]
  N57[npm:~/config/database]
  N58[integration/media/access-denied-integration.test.ts]
  N59[npm:~/infrastructure/ai/rust-ai-client]
  N60[npm:~/infrastructure/processing/image-processor]
  N61[npm:~/infrastructure/repositories/author-repository]
  N62[npm:~/infrastructure/repositories/character-repository]
  N63[npm:~/infrastructure/repositories/ip-repository]
  N64[npm:~/infrastructure/repositories/media-repository]
  N65[npm:~/infrastructure/repositories/project-repository]
  N66[npm:~/infrastructure/repositories/source-repository]
  N67[npm:~/infrastructure/repositories/tag-repository]
  N68[npm:~/infrastructure/service-registry]
  N69[npm:~/infrastructure/services/media-service]
  N70[npm:~/infrastructure/storage/server-media-storage]
  N71[integration/media/add-media-integration.test.ts]
  N72[npm:~/infrastructure/db/index]
  N73[integration/media/copy-media-integration.test.ts]
  N74[integration/media/delete-media-integration.test.ts]
  N75[integration/media/get-media-details-integration.test.ts]
  N76[integration/media/get-media-integration.test.ts]
  N77[integration/media/list-media-integration.test.ts]
  N78[integration/media/media-type-handling.test.ts]
  N79[integration/media/register-media-integration.test.ts]
  N80[integration/media/update-media-integration.test.ts]
  N81[integration/queries/search.test.ts]
  N82[integration/repository/author-dedupe.test.ts]
  N83[apps/server/node_modules/drizzle-orm/pglite/migrator.d.ts]
  N84[integration/repository/character-repository.test.ts]
  N85[integration/security/backup-security.test.ts]
  N86[npm:~/infrastructure/services/backup-service]
  N87[integration/security/path-traversal.test.ts]
  N88[integration/ai/postgres-ccip-vector-store.test.ts]
  N89[npm:@solid-imager/application/ports/ccip-vector-store]
  N90[monorepo-migration.test.ts]
  N91[setup-integration.ts]
  N92[apps/server/node_modules/dotenv/lib/main.d.ts]
  N93[setup-unit.ts]
  N94[setup.ts]
  N95[unit/application/registry.test.ts]
  N96[unit/application/services/backup-service.test.ts]
  N97[unit/application/services/character-service.test.ts]
  N98[unit/application/services/directory-sync-service.test.ts]
  N99[unit/application/services/media-service.test.ts]
  N100[npm:@solid-imager/application/services/media-query-service]
  N101[npm:@solid-imager/application/services/media-transfer-service]
  N102[npm:@solid-imager/application/services/media-upload-service]
  N103[apps/server/node_modules/@solid-imager/core/src/index.ts]
  N104[npm:@solid-imager/core/domain/repositories/author-repository]
  N105[npm:@solid-imager/core/domain/repositories/character-repository]
  N106[npm:@solid-imager/core/domain/repositories/ip-repository]
  N107[npm:@solid-imager/core/domain/repositories/job-repository]
  N108[npm:@solid-imager/core/domain/repositories/media-repository]
  N109[npm:@solid-imager/core/domain/repositories/project-repository]
  N110[npm:@solid-imager/core/domain/repositories/source-repository]
  N111[npm:@solid-imager/core/domain/repositories/tag-repository]
  N112[npm:@solid-imager/core/domain/services/image-processor]
  N113[npm:~/infrastructure/db/transaction-manager]
  N114[unit/application/services/ccip-vector-service.test.ts]
  N115[npm:@solid-imager/application/services/ccip-vector-service]
  N116[unit/application/services/maintenance-service.test.ts]
  N117[unit/application/services/media-processing-service.test.ts]
  N118[npm:~/infrastructure/services/media-processing-service]
  N119[unit/application/services/tagging-service.test.ts]
  N120[npm:@solid-imager/application/services/tagging-service]
  N121[npm:@solid-imager/core/domain/interfaces/ai-client]
  N122[unit/application/services/job-dispatch-service.test.ts]
  N123[unit/application/services/job-transfer-storage.test.ts]
  N124[unit/application/services/search-snapshot-service.test.ts]
  N125[npm:@solid-imager/core/domain/errors]
  N126[npm:@solid-imager/core/domain/repositories/search-snapshot-repository]
  N127[unit/config/database.test.ts]
  N128[unit/db/connection.test.ts]
  N129[unit/domain/media/schemas.test.ts]
  N130[unit/domain/media/utils/hash-utils.test.ts]
  N131[apps/server/node_modules/@solid-imager/application/src/index.ts]
  N132[unit/domain/media/utils/metadata-utils.test.ts]
  N133[npm:@solid-imager/core/domain/media/utils/metadata-utils]
  N134[unit/domain/search-mode-transition.test.ts]
  N135[npm:@solid-imager/core/domain/search/logic]
  N136[unit/infrastructure/api-clients/ai-api.test.ts]
  N137[npm:~/infrastructure/api-clients/ai-api]
  N138[unit/infrastructure/api-clients/downloads-api.test.ts]
  N139[npm:~/infrastructure/api-clients/downloads-api]
  N140[unit/infrastructure/api-clients/sources-api-ext.test.ts]
  N141[unit/infrastructure/file-system/node-file-system.test.ts]
  N142[npm:~/infrastructure/file-system/node-file-system]
  N143[unit/infrastructure/jobs/download-jobs.test.ts]
  N144[npm:~/infrastructure/jobs/download-jobs]
  N145[unit/infrastructure/jobs/download-rate-limiter.test.ts]
  N146[unit/infrastructure/jobs/job-worker.test.ts]
  N147[npm:@solid-imager/core/domain/config/config-schema]
  N148[npm:~/domain/repositories/job-repository]
  N149[npm:~/infrastructure/jobs/job-worker]
  N150[unit/infrastructure/jobs/ccip-jobs.test.ts]
  N151[unit/infrastructure/jobs/tagging-jobs.test.ts]
  N152[unit/infrastructure/storage/server-media-storage.test.ts]
  N153[apps/server/node_modules/fluent-ffmpeg/index.js]
  N154[unit/infrastructure/events/realtime-event-bus.test.ts]
  N155[npm:@solid-imager/core/domain/sources/events]
  N156[npm:~/infrastructure/events/realtime-event-bus]
  N157[unit/infrastructure/api/rpc-response-headers.test.ts]
  N158[apps/server/node_modules/@orpc/server/dist/index.d.mts]
  N159[npm:@orpc/server/fetch]
  N160[npm:@orpc/server/plugins]
  N161[npm:~/infrastructure/api/rpc-response-headers]
  N162[unit/infrastructure/ai/inference-options.test.ts]
  N163[npm:~/infrastructure/ai/inference-options]
  N164[unit/media/copy-media-job.test.ts]
  N165[npm:~/infrastructure/jobs/thumbnails]
  N166[unit/security/file-validation.test.ts]
  N167[unit/server-config-service.test.ts]
  N168[npm:~/infrastructure/services/server-config-service]
  N0 --> N1
  N0 --> N2
  N3 --> N1
  N3 --> N2
  N4 --> N1
  N4 --> N2
  N5 --> N1
  N5 --> N2
  N6 --> N7
  N6 --> N1
  N6 --> N8
  N6 --> N2
  N9 --> N7
  N9 --> N10
  N9 --> N1
  N9 --> N8
  N11 --> N7
  N11 --> N10
  N11 --> N1
  N11 --> N8
  N11 --> N2
  N12 --> N7
  N12 --> N10
  N12 --> N1
  N12 --> N8
  N12 --> N2
  N13 --> N1
  N13 --> N2
  N14 --> N1
  N14 --> N2
  N15 --> N16
  N15 --> N17
  N18 --> N16
  N19 --> N16
  N20 --> N21
  N20 --> N22
  N20 --> N23
  N20 --> N16
  N24 --> N16
  N25 --> N17
  N26 --> N21
  N26 --> N22
  N26 --> N23
  N27 --> N16
  N27 --> N28
  N27 --> N17
  N29 --> N16
  N28 --> N23
  N17 --> N16
  N30 --> N16
  N31 --> N32
  N31 --> N33
  N31 --> N34
  N31 --> N35
  N31 --> N36
  N31 --> N37
  N31 --> N38
  N39 --> N7
  N40 --> N23
  N40 --> N41
  N40 --> N42
  N40 --> N43
  N40 --> N44
  N40 --> N45
  N46 --> N16
  N47 --> N16
  N47 --> N28
  N47 --> N17
  N48 --> N22
  N48 --> N49
  N48 --> N1
  N48 --> N50
  N51 --> N49
  N51 --> N1
  N51 --> N50
  N52 --> N53
  N52 --> N22
  N52 --> N54
  N52 --> N23
  N52 --> N55
  N52 --> N49
  N52 --> N1
  N52 --> N50
  N56 --> N53
  N56 --> N23
  N56 --> N1
  N56 --> N57
  N58 --> N1
  N58 --> N59
  N58 --> N60
  N58 --> N61
  N58 --> N62
  N58 --> N63
  N58 --> N64
  N58 --> N65
  N58 --> N66
  N58 --> N67
  N58 --> N68
  N58 --> N69
  N58 --> N70
  N71 --> N49
  N71 --> N1
  N71 --> N72
  N71 --> N2
  N71 --> N64
  N73 --> N49
  N73 --> N1
  N73 --> N72
  N74 --> N49
  N74 --> N1
  N74 --> N8
  N74 --> N59
  N74 --> N72
  N74 --> N2
  N74 --> N60
  N74 --> N61
  N74 --> N62
  N74 --> N63
  N74 --> N64
  N74 --> N65
  N74 --> N66
  N74 --> N67
  N74 --> N68
  N74 --> N69
  N74 --> N70
  N75 --> N22
  N75 --> N23
  N76 --> N1
  N76 --> N8
  N76 --> N59
  N76 --> N72
  N76 --> N2
  N76 --> N60
  N76 --> N61
  N76 --> N62
  N76 --> N63
  N76 --> N64
  N76 --> N65
  N76 --> N66
  N76 --> N67
  N76 --> N68
  N76 --> N69
  N76 --> N70
  N77 --> N1
  N77 --> N8
  N77 --> N59
  N77 --> N72
  N77 --> N2
  N77 --> N60
  N77 --> N61
  N77 --> N62
  N77 --> N63
  N77 --> N64
  N77 --> N65
  N77 --> N66
  N77 --> N67
  N77 --> N68
  N77 --> N69
  N77 --> N70
  N78 --> N22
  N78 --> N23
  N79 --> N22
  N79 --> N23
  N79 --> N1
  N79 --> N72
  N80 --> N49
  N80 --> N1
  N80 --> N8
  N80 --> N59
  N80 --> N72
  N80 --> N2
  N80 --> N60
  N80 --> N61
  N80 --> N62
  N80 --> N63
  N80 --> N64
  N80 --> N65
  N80 --> N66
  N80 --> N67
  N80 --> N68
  N80 --> N69
  N80 --> N70
  N81 --> N1
  N81 --> N50
  N82 --> N49
  N82 --> N83
  N82 --> N1
  N82 --> N50
  N82 --> N2
  N82 --> N61
  N84 --> N49
  N84 --> N83
  N84 --> N1
  N84 --> N50
  N84 --> N2
  N84 --> N62
  N85 --> N1
  N85 --> N86
  N87 --> N22
  N87 --> N23
  N87 --> N1
  N87 --> N70
  N88 --> N23
  N88 --> N89
  N90 --> N53
  N90 --> N23
  N90 --> N1
  N91 --> N23
  N91 --> N92
  N91 --> N1
  N93 --> N23
  N93 --> N92
  N93 --> N1
  N94 --> N23
  N94 --> N92
  N94 --> N1
  N95 --> N1
  N95 --> N68
  N96 --> N7
  N96 --> N1
  N96 --> N50
  N97 --> N1
  N97 --> N68
  N98 --> N1
  N99 --> N100
  N99 --> N101
  N99 --> N102
  N99 --> N103
  N99 --> N7
  N99 --> N104
  N99 --> N105
  N99 --> N106
  N99 --> N107
  N99 --> N108
  N99 --> N109
  N99 --> N110
  N99 --> N111
  N99 --> N112
  N99 --> N1
  N99 --> N113
  N99 --> N69
  N114 --> N115
  N114 --> N1
  N116 --> N22
  N117 --> N1
  N117 --> N118
  N119 --> N120
  N119 --> N121
  N119 --> N105
  N119 --> N106
  N119 --> N108
  N119 --> N110
  N119 --> N111
  N119 --> N1
  N122 --> N1
  N122 --> N2
  N123 --> N21
  N123 --> N22
  N123 --> N54
  N123 --> N23
  N123 --> N107
  N123 --> N1
  N124 --> N125
  N124 --> N126
  N127 --> N53
  N127 --> N23
  N127 --> N1
  N127 --> N57
  N128 --> N1
  N128 --> N57
  N129 --> N7
  N129 --> N1
  N130 --> N21
  N130 --> N53
  N130 --> N54
  N130 --> N23
  N130 --> N131
  N130 --> N1
  N132 --> N133
  N132 --> N1
  N134 --> N7
  N134 --> N135
  N136 --> N1
  N136 --> N137
  N138 --> N1
  N138 --> N139
  N140 --> N1
  N141 --> N22
  N141 --> N54
  N141 --> N23
  N141 --> N1
  N141 --> N142
  N143 --> N1
  N143 --> N144
  N143 --> N64
  N145 --> N1
  N146 --> N147
  N146 --> N1
  N146 --> N148
  N146 --> N2
  N146 --> N149
  N150 --> N1
  N150 --> N148
  N151 --> N1
  N151 --> N148
  N152 --> N22
  N152 --> N153
  N152 --> N43
  N152 --> N1
  N152 --> N70
  N154 --> N155
  N154 --> N1
  N154 --> N156
  N157 --> N158
  N157 --> N159
  N157 --> N160
  N157 --> N1
  N157 --> N8
  N157 --> N161
  N162 --> N1
  N162 --> N163
  N164 --> N1
  N164 --> N165
  N164 --> N64
  N164 --> N68
  N164 --> N69
  N166 --> N1
  N166 --> N69
  N167 --> N53
  N167 --> N22
  N167 --> N147
  N167 --> N1
  N167 --> N168
```
