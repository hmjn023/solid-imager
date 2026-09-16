# solid-imager source dependencies (indexion)

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
  N19["apps/server/src/app.css"]
  N20["url:"]
  N21["apps/server/src/components/layout/layout.tsx"]
  N22["npm:@solid-imager/ui/router-status"]
  N23["node_modules/@tanstack/solid-router/dist/cjs/index.cjs"]
  N24["npm:~/components/api-activity-indicator"]
  N25["apps/server/src/components/layout/app-shell.tsx"]
  N26["apps/server/src/components/layout/mobile-header.tsx"]
  N27["npm:@solid-imager/ui/button"]
  N28["npm:@solid-imager/ui/workspace/icons"]
  N29["npm:~/components/imports/pending-downloads-indicator"]
  N30["apps/server/src/components/layout/sidebar.tsx"]
  N31["npm:@solid-imager/core/domain/sources/schemas"]
  N32["npm:@solid-imager/ui/shortcuts/index"]
  N33["apps/server/src/components/layout/source-list.tsx"]
  N34["apps/server/src/components/pages/about-page.tsx"]
  N35["npm:@solid-imager/ui/badge"]
  N36["apps/server/src/components/pages/config-page.tsx"]
  N37["npm:@solid-imager/ui/query-options"]
  N38["npm:@solid-imager/ui/query-state"]
  N39["npm:@solid-imager/ui/screens/config-state-screen"]
  N40["node_modules/@tanstack/solid-query/build/index.cjs"]
  N41["npm:~/infrastructure/api-clients/orpc-client"]
  N42["npm:~/infrastructure/api-clients/queries"]
  N43["apps/server/src/components/pages/jobs-page.tsx"]
  N44["npm:@solid-imager/core/domain/jobs/schemas"]
  N45["npm:@solid-imager/ui/hooks/use-job-events"]
  N46["apps/server/src/components/pages/manager-page.tsx"]
  N47["npm:@solid-imager/ui/hooks/use-manager-page"]
  N48["npm:@solid-imager/ui/screens/manager/types"]
  N49["npm:@solid-imager/ui/screens/manager-screen"]
  N50["npm:@solid-imager/ui/toast"]
  N51["npm:~/hooks/use-batch-job-events"]
  N52["apps/server/src/components/pages/media-detail-page.tsx"]
  N53["npm:@solid-imager/core/domain/media/schemas"]
  N54["npm:@solid-imager/ui/screens/media-detail-screen"]
  N55["apps/server/src/components/pages/search-content.tsx"]
  N56["apps/server/src/components/imports/pending-downloads-indicator.tsx"]
  N57["npm:@solid-imager/ui/pending-downloads-indicator"]
  N58["apps/server/src/components/imports/pending-downloads-indicator-data.ts"]
  N59["npm:@solid-imager/ui/event-stream"]
  N60["apps/server/src/components/media/ai-tagging-modal.tsx"]
  N61["npm:@solid-imager/ui/ai-tagging-modal"]
  N62["npm:~/infrastructure/api-clients/ai-api"]
  N63["apps/server/src/components/media/association-manager.tsx"]
  N64["apps/server/src/components/media/bulk-action-dialog.tsx"]
  N65["apps/server/src/components/media/character-crop-modal.tsx"]
  N66["npm:@solid-imager/ui/character-crop-modal"]
  N67["apps/server/src/components/media/search-filters.tsx"]
  N68["npm:@solid-imager/core/domain/authors/schemas"]
  N69["npm:@solid-imager/core/domain/characters/schemas"]
  N70["npm:@solid-imager/core/domain/ips/schemas"]
  N71["npm:@solid-imager/core/domain/projects/schemas"]
  N72["npm:@solid-imager/core/domain/tags/schemas"]
  N73["apps/server/src/components/media/media-actions.tsx"]
  N74["apps/server/src/components/media/media-grid-item.tsx"]
  N75["apps/server/src/components/media/media-viewer.tsx"]
  N76["apps/server/src/components/media/move-copy-media-dialog.tsx"]
  N77["npm:@solid-imager/ui/move-copy-media-dialog"]
  N78["node_modules/solid-js/types/index.d.ts"]
  N79["npm:~/infrastructure/api-clients/sources-api"]
  N80["apps/server/src/components/media/preset-manager.tsx"]
  N81["npm:@solid-imager/ui/preset-client"]
  N82["npm:@solid-imager/ui/preset-manager"]
  N83["npm:~/infrastructure/api/clients/preset-client"]
  N84["apps/server/src/components/media/pro-search-builder.tsx"]
  N85["apps/server/src/components/media/pro-search-dialog.tsx"]
  N86["apps/server/src/components/media/search-control-panel.tsx"]
  N87["npm:@solid-imager/ui/label"]
  N88["apps/server/src/components/media/media-sidebar.tsx"]
  N89["apps/server/src/components/media/sort-controls.tsx"]
  N90["apps/server/src/components/media/thumbnail-image.tsx"]
  N91["npm:@solid-imager/ui/thumbnail-image"]
  N92["apps/server/src/components/media/oppai-oracle-modal.tsx"]
  N93["npm:@solid-imager/ui/oppai-oracle-modal"]
  N94["apps/server/src/components/media/media-context.ts"]
  N95["apps/server/src/components/simple-modal.tsx"]
  N96["apps/server/src/components/api-activity-indicator.tsx"]
  N97["apps/server/src/components/not-found.tsx"]
  N98["apps/server/src/components/swagger-ui.tsx"]
  N99["node_modules/swagger-ui-dist/swagger-ui-bundle.js"]
  N100["node_modules/swagger-ui-dist/swagger-ui.css"]
  N101["apps/server/src/components/upload-media-modal.tsx"]
  N102["npm:@solid-imager/ui/upload-media-modal-content"]
  N103["npm:~/infrastructure/api-clients/fetch-url-api"]
  N104["apps/server/src/components/route-compat.tsx"]
  N105["npm:@solid-imager/ui/route-compat"]
  N106["npm:~/components/not-found"]
  N107["apps/server/src/config/database.ts"]
  N108["node_modules/zod/index.d.cts"]
  N109["apps/server/src/infrastructure/ai/rust-ai-client.ts"]
  N110["npm:node:os"]
  N111["apps/server/node_modules/@solid-imager/client/src/index.ts"]
  N112["npm:@solid-imager/core/domain/config/config-schema"]
  N113["npm:@solid-imager/core/domain/interfaces/ai-client"]
  N114["apps/server/src/infrastructure/ai/inference-options.ts"]
  N115["node_modules/dghs-imgutils-rs/index.js"]
  N116["apps/server/src/infrastructure/api-clients/ai-api.ts"]
  N117["npm:@solid-imager/core/domain/tagging/schemas"]
  N118["apps/server/src/infrastructure/api-clients/orpc-client.ts"]
  N119["node_modules/@orpc/server/dist/index.d.mts"]
  N120["npm:@tanstack/solid-start"]
  N121["npm:@tanstack/solid-start/server"]
  N122["npm:~/infrastructure/api/app-router"]
  N123["apps/server/src/infrastructure/api-clients/characters-api.ts"]
  N124["apps/server/src/infrastructure/api-clients/downloads-api.ts"]
  N125["apps/server/src/infrastructure/api-clients/fetch-url-api.ts"]
  N126["apps/server/src/infrastructure/api-clients/ips-api.ts"]
  N127["apps/server/src/infrastructure/api-clients/media-api.ts"]
  N128["apps/server/src/infrastructure/api-clients/search-api.ts"]
  N129["apps/server/src/infrastructure/api-clients/projects-api.ts"]
  N130["apps/server/src/infrastructure/api-clients/queries/index.ts"]
  N131["node_modules/@orpc/solid-query/dist/index.d.mts"]
  N132["apps/server/src/infrastructure/api-clients/sources-api.ts"]
  N133["apps/server/src/infrastructure/api-clients/thumbnails.ts"]
  N134["apps/server/src/infrastructure/api/clients/preset-client.ts"]
  N135["npm:@solid-imager/core/domain/contract/presets-client"]
  N136["apps/server/src/infrastructure/api/clients/search-history-client.ts"]
  N137["npm:@solid-imager/core/domain/contract/search-snapshots-client"]
  N138["apps/server/src/infrastructure/api/routers/ai-router.ts"]
  N139["apps/server/src/infrastructure/api/routers/authors-router.ts"]
  N140["npm:@solid-imager/core/domain/contract/authors.contract"]
  N141["npm:~/infrastructure/repositories/authors-repository"]
  N142["apps/server/src/infrastructure/api/routers/categories-router.ts"]
  N143["npm:@solid-imager/core/domain/contract/categories.contract"]
  N144["npm:~/infrastructure/services/category-service"]
  N145["apps/server/src/infrastructure/api/routers/characters-router.ts"]
  N146["npm:@solid-imager/core/domain/contract/characters.contract"]
  N147["npm:~/infrastructure/services/character-service"]
  N148["apps/server/src/infrastructure/api/routers/entity-media-counts.ts"]
  N149["apps/server/src/infrastructure/api/routers/config-router.ts"]
  N150["npm:@solid-imager/core/domain/contract/config.contract"]
  N151["npm:~/infrastructure/service-registry"]
  N152["apps/server/src/infrastructure/api/routers/directories-router.ts"]
  N153["npm:@solid-imager/core/domain/contract/directories.contract"]
  N154["npm:~/infrastructure/services/directory-service"]
  N155["apps/server/src/infrastructure/api/routers/downloads-router.ts"]
  N156["npm:@solid-imager/core/domain/contract/downloads.contract"]
  N157["npm:~/infrastructure/jobs/download-jobs"]
  N158["apps/server/src/infrastructure/api/routers/imports-router.ts"]
  N159["npm:@solid-imager/core/domain/contract/imports.contract"]
  N160["npm:@solid-imager/core/domain/sources/events"]
  N161["node_modules/drizzle-orm/index.d.ts"]
  N162["npm:~/infrastructure/db"]
  N163["npm:~/infrastructure/db/schema"]
  N164["npm:~/infrastructure/events/realtime-event-bus"]
  N165["npm:~/infrastructure/services/backup-service"]
  N166["apps/server/src/infrastructure/api/routers/ips-router.ts"]
  N167["npm:@solid-imager/core/domain/contract/ips.contract"]
  N168["npm:~/infrastructure/services/ip-service"]
  N169["apps/server/src/infrastructure/api/routers/media-router.ts"]
  N170["npm:@solid-imager/core/domain/contract/media.contract"]
  N171["npm:@solid-imager/core/domain/errors"]
  N172["npm:@solid-imager/core/utils/async-pool"]
  N173["npm:~/infrastructure/logger"]
  N174["npm:~/infrastructure/services/bulk-operation-service"]
  N175["npm:~/infrastructure/services/ccip-vector-service"]
  N176["npm:~/infrastructure/services/media-service"]
  N177["apps/server/src/infrastructure/api/routers/presets-router.ts"]
  N178["npm:@solid-imager/core/domain/contract/presets.contract"]
  N179["npm:~/infrastructure/services/preset-service"]
  N180["apps/server/src/infrastructure/api/routers/projects-router.ts"]
  N181["npm:@solid-imager/core/domain/contract/projects.contract"]
  N182["npm:~/infrastructure/services/project-service"]
  N183["apps/server/src/infrastructure/api/routers/sources-router.ts"]
  N184["npm:node:crypto"]
  N185["apps/server/src/infrastructure/api/routers/tags-router.ts"]
  N186["npm:@solid-imager/core/domain/contract/tags.contract"]
  N187["npm:~/infrastructure/services/tag-service"]
  N188["apps/server/src/infrastructure/api/routers/thumbnails-router.ts"]
  N189["npm:@solid-imager/core/domain/contract/thumbnails.contract"]
  N190["npm:~/infrastructure/services/thumbnail-service"]
  N191["apps/server/src/infrastructure/api/routers/utils-router.ts"]
  N192["npm:@solid-imager/core/domain/contract/utils.contract"]
  N193["apps/server/src/infrastructure/api/routers/jobs-router.ts"]
  N194["npm:@solid-imager/core/domain/contract/jobs.contract"]
  N195["apps/server/src/infrastructure/api/routers/search-snapshots-router.ts"]
  N196["npm:@solid-imager/core/domain/contract/search-snapshots.contract"]
  N197["npm:@solid-imager/core/domain/search/history"]
  N198["npm:~/infrastructure/services/search-snapshot-service"]
  N199["apps/server/src/infrastructure/api/job-artifact.ts"]
  N200["npm:node:fs/promises"]
  N201["npm:@solid-imager/core/domain/repositories/job-repository"]
  N202["npm:~/infrastructure/repositories/job-repository"]
  N203["npm:~/infrastructure/services/job-transfer-storage"]
  N204["npm:~/infrastructure/utils/stream-utils"]
  N205["apps/server/src/infrastructure/api/app-router.ts"]
  N206["node_modules/zod/compile.d.ts"]
  N207["npm:~/infrastructure/api/routers/ai-router"]
  N208["npm:~/infrastructure/api/routers/authors-router"]
  N209["npm:~/infrastructure/api/routers/categories-router"]
  N210["npm:~/infrastructure/api/routers/characters-router"]
  N211["npm:~/infrastructure/api/routers/config-router"]
  N212["npm:~/infrastructure/api/routers/directories-router"]
  N213["npm:~/infrastructure/api/routers/downloads-router"]
  N214["npm:~/infrastructure/api/routers/imports-router"]
  N215["npm:~/infrastructure/api/routers/ips-router"]
  N216["npm:~/infrastructure/api/routers/jobs-router"]
  N217["npm:~/infrastructure/api/routers/media-router"]
  N218["npm:~/infrastructure/api/routers/presets-router"]
  N219["npm:~/infrastructure/api/routers/projects-router"]
  N220["npm:~/infrastructure/api/routers/search-snapshots-router"]
  N221["npm:~/infrastructure/api/routers/sources-router"]
  N222["npm:~/infrastructure/api/routers/tags-router"]
  N223["npm:~/infrastructure/api/routers/thumbnails-router"]
  N224["npm:~/infrastructure/api/routers/utils-router"]
  N225["apps/server/src/infrastructure/bootstrap.ts"]
  N226["npm:~/infrastructure/ai/rust-ai-client"]
  N227["npm:~/infrastructure/db/transaction-manager"]
  N228["npm:~/infrastructure/file-system/node-file-system"]
  N229["npm:~/infrastructure/jobs/download-rate-limiter"]
  N230["npm:~/infrastructure/jobs/job-worker"]
  N231["apps/server/src/infrastructure/db/__mocks__/index.ts"]
  N232["npm:uuid"]
  N233["apps/server/src/infrastructure/db/connection.ts"]
  N234["node_modules/@electric-sql/pglite/dist/index.cjs"]
  N235["npm:bun"]
  N236["node_modules/pg/esm/index.mjs"]
  N237["npm:~/config/database"]
  N238["apps/server/src/infrastructure/db/pglite.ts"]
  N239["apps/server/src/infrastructure/db/postgres-driver.ts"]
  N240["apps/server/src/infrastructure/db/data-migration.ts"]
  N241["npm:~/infrastructure/db/index"]
  N242["apps/server/src/infrastructure/db/executor.ts"]
  N243["npm:@solid-imager/db/types"]
  N244["apps/server/src/infrastructure/db/index.ts"]
  N245["node_modules/drizzle-orm/bun-sql/index.d.ts"]
  N246["node_modules/drizzle-orm/node-postgres/index.d.ts"]
  N247["node_modules/drizzle-orm/pglite/index.d.ts"]
  N248["apps/server/src/infrastructure/db/schema.ts"]
  N249["node_modules/@electric-sql/pglite-pgvector/dist/index.cjs"]
  N250["apps/server/src/infrastructure/file-system/node-file-system.ts"]
  N251["apps/server/node_modules/@solid-imager/core/src/index.ts"]
  N252["apps/server/src/infrastructure/jobs/download-jobs.ts"]
  N253["apps/server/src/infrastructure/jobs/download-rate-limiter.ts"]
  N254["apps/server/src/infrastructure/jobs/file-watcher-service.ts"]
  N255["npm:~/infrastructure/jobs/file-watcher-manager"]
  N256["npm:~/infrastructure/jobs/thumbnails"]
  N257["npm:~/infrastructure/repositories/media-repository"]
  N258["npm:~/infrastructure/repositories/source-repository"]
  N259["npm:~/infrastructure/services/directory-sync-service"]
  N260["npm:~/infrastructure/services/media-processing-service"]
  N261["npm:~/infrastructure/storage/server-media-storage"]
  N262["apps/server/src/infrastructure/jobs/ccip-jobs.ts"]
  N263["npm:@solid-imager/application/ports/ccip-vector-store"]
  N264["apps/server/src/infrastructure/jobs/job-worker.ts"]
  N265["npm:~/domain/repositories/job-repository"]
  N266["apps/server/src/infrastructure/jobs/tagging-jobs.ts"]
  N267["apps/server/src/infrastructure/jobs/tag-extraction.ts"]
  N268["npm:~/infrastructure/processing/image-processor"]
  N269["npm:~/infrastructure/repositories/tag-repository"]
  N270["apps/server/src/infrastructure/jobs/thumbnails.ts"]
  N271["apps/server/src/infrastructure/jobs/file-watcher-manager.ts"]
  N272["node_modules/chokidar/index.js"]
  N273["apps/server/src/infrastructure/logger.ts"]
  N274["node_modules/pino/pino.js"]
  N275["apps/server/src/infrastructure/processing/image-processor.ts"]
  N276["node_modules/sharp/dist/index.cjs"]
  N277["apps/server/src/infrastructure/processing/bun-image.ts"]
  N278["apps/server/src/infrastructure/repositories/author-repository.ts"]
  N279["npm:@solid-imager/core/domain/repositories/author-repository"]
  N280["npm:@solid-imager/db/repositories/author-repository"]
  N281["npm:~/infrastructure/db/executor"]
  N282["apps/server/src/infrastructure/repositories/authors-repository.ts"]
  N283["npm:@solid-imager/core/domain/repositories/authors-repository"]
  N284["npm:@solid-imager/db/repositories/authors-repository"]
  N285["apps/server/src/infrastructure/repositories/category-repository.ts"]
  N286["npm:@solid-imager/core/domain/repositories/category-repository"]
  N287["npm:@solid-imager/db/repositories/category-repository"]
  N288["apps/server/src/infrastructure/repositories/character-repository.ts"]
  N289["npm:@solid-imager/core/domain/repositories/character-repository"]
  N290["npm:@solid-imager/db/repositories/character-repository"]
  N291["apps/server/src/infrastructure/repositories/collection-repository.ts"]
  N292["npm:@solid-imager/core/domain/repositories/collection-repository"]
  N293["npm:@solid-imager/db/repositories/collection-repository"]
  N294["apps/server/src/infrastructure/repositories/ip-repository.ts"]
  N295["npm:@solid-imager/core/domain/repositories/ip-repository"]
  N296["npm:@solid-imager/db/repositories/ip-repository"]
  N297["apps/server/src/infrastructure/repositories/job-repository.ts"]
  N298["apps/server/src/infrastructure/repositories/media-repository-utils.ts"]
  N299["npm:@solid-imager/db/repositories/media-repository-utils"]
  N300["apps/server/src/infrastructure/repositories/media-repository.ts"]
  N301["npm:@solid-imager/core/domain/repositories/media-repository"]
  N302["npm:@solid-imager/db/repositories/media-repository"]
  N303["npm:~/infrastructure/repositories/author-repository"]
  N304["apps/server/src/infrastructure/repositories/preset-repository.ts"]
  N305["npm:@solid-imager/core/domain/repositories/preset-repository"]
  N306["npm:@solid-imager/db/repositories/preset-repository"]
  N307["apps/server/src/infrastructure/repositories/project-repository.ts"]
  N308["npm:@solid-imager/core/domain/repositories/project-repository"]
  N309["npm:@solid-imager/db/repositories/project-repository"]
  N310["apps/server/src/infrastructure/repositories/source-repository.ts"]
  N311["npm:@solid-imager/core/domain/repositories/source-repository"]
  N312["npm:@solid-imager/db/repositories/source-repository"]
  N313["apps/server/src/infrastructure/repositories/tag-repository.ts"]
  N314["npm:@solid-imager/core/domain/repositories/tag-repository"]
  N315["npm:@solid-imager/db/repositories/tag-repository"]
  N316["apps/server/src/infrastructure/repositories/user-repository.ts"]
  N317["npm:@solid-imager/core/domain/repositories/user-repository"]
  N318["npm:@solid-imager/db/repositories/user-repository"]
  N319["apps/server/src/infrastructure/repositories/search-snapshot-repository.ts"]
  N320["npm:@solid-imager/core/domain/repositories/search-snapshot-repository"]
  N321["npm:@solid-imager/db/repositories/search-snapshot-repository"]
  N322["apps/server/src/infrastructure/storage/factory.ts"]
  N323["apps/server/src/infrastructure/storage/local.ts"]
  N324["apps/server/src/infrastructure/storage/schema.ts"]
  N325["apps/server/src/infrastructure/storage/server-media-storage.ts"]
  N326["apps/server/src/infrastructure/utils/ffmpeg.ts"]
  N327["node_modules/fluent-ffmpeg/index.js"]
  N328["apps/server/src/infrastructure/utils/stream-utils.ts"]
  N329["apps/server/src/infrastructure/events/realtime-event-bus.ts"]
  N330["npm:node:events"]
  N331["apps/server/src/infrastructure/router/route-types.ts"]
  N332["apps/server/src/infrastructure/server-route-bootstrap.ts"]
  N333["apps/server/src/infrastructure/services/author-service.ts"]
  N334["npm:@solid-imager/application/services/author-service"]
  N335["apps/server/src/infrastructure/services/backup-service.ts"]
  N336["apps/server/src/infrastructure/services/bulk-operation-service.ts"]
  N337["apps/server/src/infrastructure/services/category-service.ts"]
  N338["npm:@solid-imager/application/services/category-service"]
  N339["npm:~/infrastructure/repositories/category-repository"]
  N340["apps/server/src/infrastructure/services/ccip-vector-service.ts"]
  N341["npm:@solid-imager/application/ports/media-service"]
  N342["npm:@solid-imager/application/services/ccip-vector-service"]
  N343["npm:~/infrastructure/ai/postgres-ccip-vector-store"]
  N344["npm:~/infrastructure/services/tagging-service"]
  N345["apps/server/src/infrastructure/services/collection-service.ts"]
  N346["npm:@solid-imager/application/services/collection-service"]
  N347["npm:~/infrastructure/repositories/collection-repository"]
  N348["apps/server/src/infrastructure/services/directory-service.ts"]
  N349["npm:~/infrastructure/services/media-source-service"]
  N350["npm:~/infrastructure/storage/factory"]
  N351["apps/server/src/infrastructure/services/directory-sync-service.ts"]
  N352["apps/server/src/infrastructure/services/ip-service.ts"]
  N353["npm:@solid-imager/application/services/ip-service"]
  N354["npm:~/infrastructure/repositories/ip-repository"]
  N355["apps/server/src/infrastructure/services/job-dispatch-service.ts"]
  N356["apps/server/src/infrastructure/services/job-transfer-storage.ts"]
  N357["apps/server/src/infrastructure/services/maintenance-service.ts"]
  N358["apps/server/src/infrastructure/services/media-processing-service.ts"]
  N359["npm:@solid-imager/core/domain/interfaces/transaction-manager"]
  N360["apps/server/src/infrastructure/services/preset-service.ts"]
  N361["apps/server/node_modules/@solid-imager/application/src/index.ts"]
  N362["npm:@solid-imager/application/services/preset-service"]
  N363["npm:~/infrastructure/repositories/preset-repository"]
  N364["apps/server/src/infrastructure/services/project-service.ts"]
  N365["npm:@solid-imager/application/services/project-service"]
  N366["npm:~/infrastructure/repositories/project-repository"]
  N367["apps/server/src/infrastructure/services/search-service.ts"]
  N368["npm:@solid-imager/application/services/search-service"]
  N369["apps/server/src/infrastructure/services/search-snapshot-service.ts"]
  N370["npm:@solid-imager/application/services/search-snapshot-service"]
  N371["npm:~/infrastructure/repositories/search-snapshot-repository"]
  N372["apps/server/src/infrastructure/services/server-config-service.ts"]
  N373["npm:node:util"]
  N374["apps/server/src/infrastructure/services/source-transfer-job-service.ts"]
  N375["apps/server/src/infrastructure/services/tag-service.ts"]
  N376["npm:@solid-imager/application/services/tag-service"]
  N377["apps/server/src/infrastructure/services/tagging-service.ts"]
  N378["npm:@solid-imager/application/services/tagging-service"]
  N379["apps/server/src/infrastructure/services/thumbnail-service.ts"]
  N380["npm:@solid-imager/core/domain/thumbnails/schemas"]
  N381["apps/server/src/infrastructure/services/user-service.ts"]
  N382["npm:@solid-imager/application/services/user-service"]
  N383["npm:~/infrastructure/repositories/user-repository"]
  N384["apps/server/src/router.tsx"]
  N385["apps/server/src/routes/$.tsx"]
  N386["npm:~/components/route-compat"]
  N387["apps/server/src/routes/__root.tsx"]
  N388["apps/server/src/routes/about.tsx"]
  N389["npm:~/components/pages/about-page"]
  N390["apps/server/src/routes/api/rpc.$.ts"]
  N391["npm:@orpc/server/fetch"]
  N392["npm:@orpc/server/plugins"]
  N393["npm:~/infrastructure/api/rpc-response-headers"]
  N394["npm:~/infrastructure/router/route-types"]
  N395["npm:~/infrastructure/server-route-bootstrap"]
  N396["apps/server/src/routes/api/sources.$mediaSourceId.$mediaId.ts"]
  N397["npm:@solid-imager/core/domain/media/utils/media-type-utils"]
  N398["apps/server/src/routes/api/jobs.$jobId.artifact.ts"]
  N399["apps/server/src/routes/api/sources.$mediaSourceId.thumbnail.$mediaId.ts"]
  N400["apps/server/src/routes/api/health.ts"]
  N401["apps/server/src/routes/config.tsx"]
  N402["npm:~/components/pages/config-page"]
  N403["apps/server/src/routes/jobs.tsx"]
  N404["npm:~/components/pages/jobs-page"]
  N405["apps/server/src/routes/docs/swagger/index.tsx"]
  N406["apps/server/src/routes/index.tsx"]
  N407["apps/server/src/routes/manager.tsx"]
  N408["npm:~/components/pages/manager-page"]
  N409["apps/server/src/routes/search.tsx"]
  N410["npm:@solid-imager/ui/search-history-route"]
  N411["apps/server/src/routes/sources/$mediaSourceId/$mediaId/index.tsx"]
  N412["npm:~/components/pages/media-detail-page"]
  N413["apps/server/src/routes/sources/$mediaSourceId/components/source-media-page.tsx"]
  N414["npm:@solid-imager/ui/screens/source-media-screen"]
  N415["npm:@solid-imager/ui/search-history-client"]
  N416["npm:@solid-imager/ui/stores/search-store"]
  N417["apps/server/src/routes/sources/$mediaSourceId/components/source-media-controller.tsx"]
  N418["npm:@solid-imager/ui/hooks/use-current-search-persistence"]
  N419["apps/server/src/routes/sources/$mediaSourceId/index.tsx"]
  N420["apps/server/src/routes/sources/index.tsx"]
  N421["apps/server/src/routes/design-lab.tsx"]
  N422["npm:@solid-imager/ui/screens/design-concept-screen"]
  N423["apps/server/src/tests/api/categories/category-id-test.ts"]
  N424["apps/server/src/tests/api/categories/index.test.ts"]
  N425["apps/server/src/tests/api/characters/character-id-test.ts"]
  N426["apps/server/src/tests/api/ips/ip-id-test.ts"]
  N427["apps/server/src/tests/api/media/add-media.test.ts"]
  N428["apps/server/src/tests/api/media/delete-media.test.ts"]
  N429["apps/server/src/tests/api/media/get-media.test.ts"]
  N430["apps/server/src/tests/api/media/list-media.test.ts"]
  N431["apps/server/src/tests/api/tags/index.test.ts"]
  N432["apps/server/src/tests/api/tags/tag-id-test.ts"]
  N433["apps/server/src/tests/e2e/app-nav.responsive.spec.ts"]
  N434["node_modules/@playwright/test/index.d.ts"]
  N435["apps/server/src/tests/e2e/support/test.ts"]
  N436["apps/server/src/tests/e2e/loading-recovery.spec.ts"]
  N437["apps/server/src/tests/e2e/media-detail-manager-config.responsive.spec.ts"]
  N438["apps/server/src/tests/e2e/realtime-preservation.spec.ts"]
  N439["apps/server/src/tests/e2e/route-reload.spec.ts"]
  N440["apps/server/src/tests/e2e/search-pro-dialog.responsive.spec.ts"]
  N441["apps/server/src/tests/e2e/search-realtime-preservation.responsive.spec.ts"]
  N442["apps/server/src/tests/e2e/search.responsive.spec.ts"]
  N443["apps/server/src/tests/e2e/support/fixture.ts"]
  N444["apps/server/src/tests/e2e/sources-source-media.responsive.spec.ts"]
  N445["apps/server/src/tests/e2e/ui-components.gallery.spec.ts"]
  N446["apps/server/src/tests/e2e/ui-gallery/index.html"]
  N447["url:ja"]
  N448["url:UTF-8"]
  N449["url:viewport"]
  N450["url:width=device-width, initial-scale=1.0"]
  N451["url:root"]
  N452["url:module"]
  N453["url:src.tsx"]
  N454["apps/server/src/tests/e2e/ui-gallery/src.tsx"]
  N455["apps/server/src/tests/e2e/ui-gallery/vite.config.ts"]
  N456["npm:node:url"]
  N457["node_modules/@tailwindcss/vite/dist/index.d.mts"]
  N458["node_modules/vite/dist/node/index.js"]
  N459["node_modules/vite-plugin-solid/dist/cjs/index.cjs"]
  N460["apps/server/src/tests/e2e/interface-interactions.responsive.spec.ts"]
  N461["apps/server/src/tests/e2e/routes.responsive.spec.ts"]
  N462["apps/server/src/tests/e2e/scroll-restoration.spec.ts"]
  N463["apps/server/src/tests/integration/backup/backup-service.test.ts"]
  N464["apps/server/src/tests/integration/backup/performance.test.ts"]
  N465["apps/server/src/tests/integration/backup/zip-backup.test.ts"]
  N466["apps/server/src/tests/integration/db/pglite-parity.test.ts"]
  N467["apps/server/src/tests/integration/media/access-denied-integration.test.ts"]
  N468["npm:~/infrastructure/repositories/character-repository"]
  N469["apps/server/src/tests/integration/media/add-media-integration.test.ts"]
  N470["apps/server/src/tests/integration/media/copy-media-integration.test.ts"]
  N471["apps/server/src/tests/integration/media/delete-media-integration.test.ts"]
  N472["apps/server/src/tests/integration/media/get-media-details-integration.test.ts"]
  N473["apps/server/src/tests/integration/media/get-media-integration.test.ts"]
  N474["apps/server/src/tests/integration/media/list-media-integration.test.ts"]
  N475["apps/server/src/tests/integration/media/media-type-handling.test.ts"]
  N476["apps/server/src/tests/integration/media/register-media-integration.test.ts"]
  N477["apps/server/src/tests/integration/media/update-media-integration.test.ts"]
  N478["apps/server/src/tests/integration/queries/search.test.ts"]
  N479["apps/server/src/tests/integration/repository/author-dedupe.test.ts"]
  N480["node_modules/drizzle-orm/pglite/migrator.d.ts"]
  N481["apps/server/src/tests/integration/repository/character-repository.test.ts"]
  N482["apps/server/src/tests/integration/security/backup-security.test.ts"]
  N483["apps/server/src/tests/integration/security/path-traversal.test.ts"]
  N484["apps/server/src/tests/integration/ai/postgres-ccip-vector-store.test.ts"]
  N485["apps/server/src/tests/monorepo-migration.test.ts"]
  N486["apps/server/src/tests/setup-integration.ts"]
  N487["node_modules/dotenv/lib/main.d.ts"]
  N488["apps/server/src/tests/setup-unit.ts"]
  N489["apps/server/src/tests/setup.ts"]
  N490["apps/server/src/tests/unit/application/registry.test.ts"]
  N491["apps/server/src/tests/unit/application/services/backup-service.test.ts"]
  N492["apps/server/src/tests/unit/application/services/character-service.test.ts"]
  N493["apps/server/src/tests/unit/application/services/directory-sync-service.test.ts"]
  N494["apps/server/src/tests/unit/application/services/media-service.test.ts"]
  N495["npm:@solid-imager/application/services/media-query-service"]
  N496["npm:@solid-imager/application/services/media-transfer-service"]
  N497["npm:@solid-imager/application/services/media-upload-service"]
  N498["npm:@solid-imager/core/domain/services/image-processor"]
  N499["apps/server/src/tests/unit/application/services/ccip-vector-service.test.ts"]
  N500["apps/server/src/tests/unit/application/services/maintenance-service.test.ts"]
  N501["apps/server/src/tests/unit/application/services/media-processing-service.test.ts"]
  N502["apps/server/src/tests/unit/application/services/tagging-service.test.ts"]
  N503["apps/server/src/tests/unit/application/services/job-dispatch-service.test.ts"]
  N504["apps/server/src/tests/unit/application/services/job-transfer-storage.test.ts"]
  N505["apps/server/src/tests/unit/application/services/search-snapshot-service.test.ts"]
  N506["apps/server/src/tests/unit/config/database.test.ts"]
  N507["apps/server/src/tests/unit/db/connection.test.ts"]
  N508["apps/server/src/tests/unit/domain/media/schemas.test.ts"]
  N509["apps/server/src/tests/unit/domain/media/utils/hash-utils.test.ts"]
  N510["apps/server/src/tests/unit/domain/media/utils/metadata-utils.test.ts"]
  N511["npm:@solid-imager/core/domain/media/utils/metadata-utils"]
  N512["apps/server/src/tests/unit/domain/search-mode-transition.test.ts"]
  N513["npm:@solid-imager/core/domain/search/logic"]
  N514["apps/server/src/tests/unit/infrastructure/api-clients/ai-api.test.ts"]
  N515["apps/server/src/tests/unit/infrastructure/api-clients/downloads-api.test.ts"]
  N516["npm:~/infrastructure/api-clients/downloads-api"]
  N517["apps/server/src/tests/unit/infrastructure/api-clients/sources-api-ext.test.ts"]
  N518["apps/server/src/tests/unit/infrastructure/file-system/node-file-system.test.ts"]
  N519["apps/server/src/tests/unit/infrastructure/jobs/download-jobs.test.ts"]
  N520["apps/server/src/tests/unit/infrastructure/jobs/download-rate-limiter.test.ts"]
  N521["apps/server/src/tests/unit/infrastructure/jobs/job-worker.test.ts"]
  N522["apps/server/src/tests/unit/infrastructure/jobs/ccip-jobs.test.ts"]
  N523["apps/server/src/tests/unit/infrastructure/jobs/tagging-jobs.test.ts"]
  N524["apps/server/src/tests/unit/infrastructure/storage/server-media-storage.test.ts"]
  N525["npm:~/infrastructure/processing/bun-image"]
  N526["apps/server/src/tests/unit/infrastructure/storage/server-media-storage-formats.test.ts"]
  N527["apps/server/src/tests/unit/infrastructure/events/realtime-event-bus.test.ts"]
  N528["apps/server/src/tests/unit/infrastructure/api/rpc-response-headers.test.ts"]
  N529["apps/server/src/tests/unit/infrastructure/ai/inference-options.test.ts"]
  N530["npm:~/infrastructure/ai/inference-options"]
  N531["apps/server/src/tests/unit/infrastructure/processing/image-processor.test.ts"]
  N532["apps/server/src/tests/unit/media/copy-media-job.test.ts"]
  N533["apps/server/src/tests/unit/security/file-validation.test.ts"]
  N534["apps/server/src/tests/unit/server-config-service.test.ts"]
  N535["npm:~/infrastructure/services/server-config-service"]
  N536["apps/server/src/routeTree.gen.ts"]
  N537["apps/tauri/src/api/entities-api.ts"]
  N538["npm:~/orpc-client"]
  N539["apps/tauri/src/api/media-api.ts"]
  N540["apps/tauri/src/api/sources-api.ts"]
  N541["apps/tauri/src/main.tsx"]
  N542["npm:@solid-imager/ui/layouts/app-shell"]
  N543["apps/tauri/node_modules/@tanstack/solid-router/dist/cjs/index.cjs"]
  N544["node_modules/solid-js/web/types/index.d.ts"]
  N545["apps/tauri/src/index.css"]
  N546["apps/tauri/src/collections/index.ts"]
  N547["apps/tauri/src/components/server-settings-screen.tsx"]
  N548["apps/tauri/src/collections/authors-collection.ts"]
  N549["node_modules/@tanstack/db/dist/cjs/index.cjs"]
  N550["node_modules/@tanstack/query-db-collection/dist/cjs/index.cjs"]
  N551["node_modules/@tanstack/tauri-db-sqlite-persistence/dist/cjs/index.cjs"]
  N552["npm:~/infrastructure/db/persistence"]
  N553["npm:~/router"]
  N554["apps/tauri/src/collections/query-keys.ts"]
  N555["apps/tauri/src/collections/characters-collection.ts"]
  N556["apps/tauri/src/collections/ips-collection.ts"]
  N557["apps/tauri/src/collections/projects-collection.ts"]
  N558["apps/tauri/src/collections/sources-collection.ts"]
  N559["apps/tauri/src/collections/tags-collection.ts"]
  N560["apps/tauri/src/components/imports/import-review-modal.tsx"]
  N561["npm:@solid-imager/ui/tauri-import-review-modal"]
  N562["apps/tauri/src/components/imports/pending-downloads-indicator.tsx"]
  N563["npm:@solid-imager/ui/tauri-pending-downloads-indicator"]
  N564["apps/tauri/src/components/media/ai-tagging-modal.tsx"]
  N565["apps/tauri/src/components/media/character-crop-modal.tsx"]
  N566["apps/tauri/src/components/media/media-grid-item.tsx"]
  N567["apps/tauri/src/components/media/media-sidebar/media-sidebar-content.tsx"]
  N568["npm:@solid-imager/ui/media-sidebar-content"]
  N569["apps/tauri/src/components/media/media-viewer.tsx"]
  N570["apps/tauri/src/components/media/move-copy-media-dialog.tsx"]
  N571["apps/tauri/src/components/media/thumbnail-image.tsx"]
  N572["apps/tauri/src/components/nav.tsx"]
  N573["npm:@solid-imager/ui/layouts/app-nav"]
  N574["apps/tauri/src/components/upload-media-modal/upload-media-modal-content.tsx"]
  N575["apps/tauri/src/infrastructure/api-clients/ai-api.ts"]
  N576["apps/tauri/src/infrastructure/api-clients/characters-api.ts"]
  N577["apps/tauri/src/infrastructure/api-clients/imports-api.ts"]
  N578["apps/tauri/src/infrastructure/api-clients/ips-api.ts"]
  N579["apps/tauri/src/infrastructure/api-clients/projects-api.ts"]
  N580["apps/tauri/src/infrastructure/api-clients/search-api.ts"]
  N581["apps/tauri/src/infrastructure/api-clients/thumbnails-api.ts"]
  N582["apps/tauri/src/infrastructure/api/clients/preset-client.ts"]
  N583["apps/tauri/src/infrastructure/api/clients/search-history-client.ts"]
  N584["apps/tauri/src/infrastructure/db/persistence.ts"]
  N585["node_modules/@tauri-apps/plugin-sql/dist-js/index.cjs"]
  N586["npm:~/infrastructure/settings/server-settings"]
  N587["apps/tauri/src/infrastructure/media/thumbnail-runtime.ts"]
  N588["npm:~/infrastructure/tauri-fetch-helpers"]
  N589["apps/tauri/src/infrastructure/tauri-fetch-helpers.ts"]
  N590["node_modules/@tauri-apps/plugin-http/dist-js/index.cjs"]
  N591["apps/tauri/src/infrastructure/api-base.ts"]
  N592["apps/tauri/src/infrastructure/settings/server-health.ts"]
  N593["apps/tauri/src/infrastructure/settings/server-settings.ts"]
  N594["node_modules/@tauri-apps/plugin-store/dist-js/index.cjs"]
  N595["npm:~/infrastructure/api-base"]
  N596["apps/tauri/src/orpc-client.ts"]
  N597["apps/tauri/node_modules/@solid-imager/client/src/index.ts"]
  N598["apps/tauri/src/queries/index.ts"]
  N599["apps/tauri/src/router.tsx"]
  N600["apps/tauri/src/routes/$.tsx"]
  N601["npm:@solid-imager/ui/screens/not-found-screen"]
  N602["apps/tauri/src/routes/__root.tsx"]
  N603["npm:~/components/nav"]
  N604["apps/tauri/src/routes/about.tsx"]
  N605["apps/tauri/src/routes/config.tsx"]
  N606["npm:@solid-imager/ui/screens/tauri-config-state-screen"]
  N607["npm:~/queries"]
  N608["apps/tauri/src/routes/index.tsx"]
  N609["apps/tauri/src/routes/jobs.tsx"]
  N610["apps/tauri/src/routes/search.tsx"]
  N611["npm:@solid-imager/ui/hooks/use-search-history-persistence"]
  N612["npm:@solid-imager/ui/hooks/use-search-page"]
  N613["npm:@solid-imager/ui/screens/tauri-search-screen"]
  N614["npm:~/components/media/media-grid-item"]
  N615["npm:~/hooks/use-media-source-events"]
  N616["npm:~/infrastructure/api/clients/search-history-client"]
  N617["apps/tauri/src/routes/sources/$mediaSourceId/$mediaId/index.tsx"]
  N618["npm:@solid-imager/ui/hooks/use-source-root-path"]
  N619["npm:@solid-imager/ui/screens/tauri-media-detail-screen"]
  N620["npm:~/components/media/media-sidebar"]
  N621["npm:~/components/media/media-viewer"]
  N622["apps/tauri/src/routes/sources/$mediaSourceId/components/source-media-page.tsx"]
  N623["npm:@solid-imager/ui/screens/tauri-source-media-screen"]
  N624["npm:@solid-imager/ui/source-media-page"]
  N625["npm:~/components/media/move-copy-media-dialog"]
  N626["npm:~/components/upload-media-modal"]
  N627["apps/tauri/src/routes/sources/$mediaSourceId/index.tsx"]
  N628["apps/tauri/src/routes/sources/index.tsx"]
  N629["npm:@solid-imager/ui/hooks/use-sources-events"]
  N630["npm:@solid-imager/ui/hooks/use-sources-page"]
  N631["npm:@solid-imager/ui/screens/sources-screen"]
  N632["npm:@solid-imager/ui/source-card"]
  N633["npm:@solid-imager/ui/source-delete-modal"]
  N634["npm:@solid-imager/ui/tauri-source-form-modal"]
  N635["node_modules/@tanstack/solid-db/dist/esm/index.js"]
  N636["npm:~/collections"]
  N637["npm:~/collections/query-keys"]
  N638["apps/tauri/src/routes/servers.tsx"]
  N639["npm:~/components/server-settings-screen"]
  N640["apps/tauri/src/routeTree.gen.ts"]
  N641["apps/tauri/src/routes/manager.tsx"]
  N642["apps/xtracter/src/api.ts"]
  N643["apps/xtracter/node_modules/@solid-imager/client/src/index.ts"]
  N644["apps/xtracter/src/background/index.ts"]
  N645["npm:@core/domain/media/utils/filename-utils"]
  N646["npm:@core/domain/sources/schemas"]
  N647["npm:@ext/api"]
  N648["apps/xtracter/src/content/danbooru.ts"]
  N649["npm:@ext/schema"]
  N650["apps/xtracter/src/utils/dom-utils.ts"]
  N651["apps/xtracter/src/content/index.ts"]
  N652["apps/xtracter/src/content/fanbox.ts"]
  N653["apps/xtracter/src/content/twitter.ts"]
  N654["apps/xtracter/src/content/twitter.test.ts"]
  N655["apps/xtracter/src/popup/index.html"]
  N656["url:en"]
  N657["url:index.tsx"]
  N658["apps/xtracter/src/popup/index.tsx"]
  N659["npm:@ext/utils/source-selection"]
  N660["apps/xtracter/src/schema.ts"]
  N661["apps/xtracter/src/utils/source-selection.test.ts"]
  N662["apps/xtracter/src/utils/source-selection.ts"]
  N663["packages/application/src/ports/media-service.ts"]
  N664["packages/application/src/ports/media-processing-service.ts"]
  N665["packages/application/src/services/ip-service.ts"]
  N666["packages/application/src/ports/ip-service.ts"]
  N667["packages/application/src/services/media-processing-service.ts"]
  N668["packages/application/src/services/media-query-service.ts"]
  N669["packages/application/node_modules/@solid-imager/core/src/index.ts"]
  N670["packages/application/src/services/media-service.ts"]
  N671["packages/application/src/services/media-transfer-service.ts"]
  N672["packages/application/src/services/media-upload-service.ts"]
  N673["packages/application/src/services/tagging-service.ts"]
  N674["npm:@solid-imager/core/domain/tagging/constants"]
  N675["packages/application/src/services/user-service.ts"]
  N676["packages/application/src/services/search-snapshot-service.ts"]
  N677["packages/application/src/utils/hash-utils.ts"]
  N678["packages/client/src/create-client.ts"]
  N679["node_modules/@orpc/client/dist/index.d.mts"]
  N680["npm:@orpc/client/fetch"]
  N681["node_modules/@orpc/contract/dist/index.d.mts"]
  N682["packages/client/src/api-error.ts"]
  N683["packages/client/src/api-error.test.ts"]
  N684["packages/client/src/create-client.test.ts"]
  N685["packages/core/src/domain/authors/schemas.ts"]
  N686["packages/core/src/domain/media/schemas.ts"]
  N687["packages/core/src/domain/categories/schemas.ts"]
  N688["packages/core/src/domain/characters/schemas.ts"]
  N689["packages/core/src/domain/collections/schemas.ts"]
  N690["packages/core/src/domain/config/config-schema.ts"]
  N691["packages/core/src/domain/contract/ai.contract.ts"]
  N692["packages/core/src/domain/contract/authors.contract.ts"]
  N693["packages/core/src/domain/contract/categories.contract.ts"]
  N694["packages/core/src/domain/contract/characters.contract.ts"]
  N695["packages/core/src/domain/contract/config.contract.ts"]
  N696["packages/core/src/domain/contract/directories.contract.ts"]
  N697["packages/core/src/domain/contract/downloads.contract.ts"]
  N698["packages/core/src/domain/contract/imports.contract.ts"]
  N699["packages/core/src/domain/contract/index.ts"]
  N700["packages/core/src/domain/contract/ips.contract.ts"]
  N701["packages/core/src/domain/contract/jobs.contract.ts"]
  N702["packages/core/src/domain/contract/media.contract.ts"]
  N703["packages/core/src/domain/contract/presets.contract.ts"]
  N704["packages/core/src/domain/contract/projects.contract.ts"]
  N705["packages/core/src/domain/contract/search-snapshots.contract.ts"]
  N706["packages/core/src/domain/contract/sources.contract.ts"]
  N707["packages/core/src/domain/contract/tags.contract.ts"]
  N708["packages/core/src/domain/contract/thumbnails.contract.ts"]
  N709["packages/core/src/domain/contract/utils.contract.ts"]
  N710["packages/core/src/domain/ips/schemas.ts"]
  N711["packages/core/src/domain/jobs/schemas.ts"]
  N712["packages/core/src/domain/sources/events.ts"]
  N713["packages/core/src/domain/contract/presets-client.ts"]
  N714["packages/core/src/domain/contract/search-snapshots-client.ts"]
  N715["packages/core/src/domain/events/media-source-events.ts"]
  N716["packages/core/src/domain/media/upload-schemas.ts"]
  N717["packages/core/src/domain/media/utils/filename-utils.ts"]
  N718["packages/core/src/domain/media/utils/metadata-utils.ts"]
  N719["npm:@/domain/media/schemas"]
  N720["packages/core/src/domain/projects/schemas.ts"]
  N721["packages/core/src/domain/repositories/author-repository.ts"]
  N722["npm:@/domain/interfaces/transaction-manager"]
  N723["packages/core/src/domain/repositories/authors-repository.ts"]
  N724["npm:@/domain/authors/schemas"]
  N725["packages/core/src/domain/repositories/category-repository.ts"]
  N726["npm:@/domain/categories/schemas"]
  N727["packages/core/src/domain/repositories/ip-repository.ts"]
  N728["npm:@/domain/ips/schemas"]
  N729["packages/core/src/domain/repositories/media-repository.ts"]
  N730["packages/core/src/domain/repositories/project-repository.ts"]
  N731["packages/core/src/domain/repositories/source-repository.ts"]
  N732["packages/core/src/domain/repositories/tag-repository.ts"]
  N733["npm:@/domain/tags/schemas"]
  N734["packages/core/src/domain/repositories/user-repository.ts"]
  N735["npm:@/domain/users/schemas"]
  N736["packages/core/src/domain/search/schema.ts"]
  N737["packages/core/src/domain/search/history.ts"]
  N738["packages/core/src/domain/services/storage-service.ts"]
  N739["npm:@/domain/media/upload-schemas"]
  N740["packages/core/src/domain/shared/schemas.ts"]
  N741["packages/core/src/domain/thumbnails/schemas.ts"]
  N742["packages/core/src/domain/sources/schemas.ts"]
  N743["packages/core/src/domain/sources/store.ts"]
  N744["node_modules/solid-js/store/types/index.d.ts"]
  N745["packages/core/src/domain/tagging/schemas.ts"]
  N746["packages/core/src/domain/tags/extractor.ts"]
  N747["packages/core/src/utils/type-guards.ts"]
  N748["packages/core/src/domain/tags/schemas.ts"]
  N749["packages/core/src/domain/users/schemas.ts"]
  N750["packages/core/src/interfaces/config-service.ts"]
  N751["npm:@/domain/config/config-schema"]
  N752["packages/core/src/interfaces/media-storage.ts"]
  N753["packages/core/src/utils/deep-equal.ts"]
  N754["packages/db/src/repositories/author-repository.ts"]
  N755["packages/db/src/repositories/authors-repository.ts"]
  N756["packages/db/src/repositories/job-repository.ts"]
  N757["packages/db/src/repositories/media-repository-utils.ts"]
  N758["packages/db/src/repositories/project-repository.ts"]
  N759["packages/db/src/repositories/job-repository.test.ts"]
  N760["packages/db/src/types.ts"]
  N761["packages/db/src/repositories/search-snapshot-repository.ts"]
  N762["packages/db/src/schema.ts"]
  N763["packages/ui/src/ai-tagging-modal.tsx"]
  N764["packages/ui/src/badge.tsx"]
  N765["packages/ui/src/association-manager.tsx"]
  N766["packages/ui/src/button.tsx"]
  N767["node_modules/class-variance-authority/dist/index.d.ts"]
  N768["packages/ui/src/utils/cn.ts"]
  N769["packages/ui/src/card.tsx"]
  N770["packages/ui/src/character-crop-modal.tsx"]
  N771["packages/ui/src/checkbox.tsx"]
  N772["packages/ui/src/clipboard-copy.tsx"]
  N773["packages/ui/src/toast.tsx"]
  N774["packages/ui/src/collapsible.tsx"]
  N775["node_modules/@kobalte/core/dist/index.d.ts"]
  N776["packages/ui/src/combobox.tsx"]
  N777["npm:@kobalte/core/combobox"]
  N778["npm:@kobalte/core/polymorphic"]
  N779["node_modules/@tanstack/solid-virtual/dist/cjs/index.cjs"]
  N780["packages/ui/src/command.tsx"]
  N781["npm:@kobalte/core/dialog"]
  N782["node_modules/cmdk-solid/dist/index.cjs"]
  N783["packages/ui/src/counter.tsx"]
  N784["packages/ui/src/dummy.test.ts"]
  N785["packages/ui/src/hooks/use-manager-page.ts"]
  N786["packages/ui/src/hooks/use-search-page.ts"]
  N787["packages/ui/src/hooks/use-source-media-page.test.ts"]
  N788["packages/ui/src/hooks/restore-import.ts"]
  N789["packages/ui/src/hooks/use-source-media-page.ts"]
  N790["packages/ui/src/hooks/use-source-root-path.test.ts"]
  N791["packages/ui/src/hooks/use-source-root-path.ts"]
  N792["packages/ui/src/hooks/use-batch-job-events.test.ts"]
  N793["packages/ui/src/hooks/use-current-search-persistence.test.ts"]
  N794["packages/ui/src/hooks/scroll-container.ts"]
  N795["packages/ui/src/hooks/use-job-events.ts"]
  N796["packages/ui/src/event-stream.ts"]
  N797["packages/ui/src/hooks/use-media-collection-selection.test.ts"]
  N798["packages/ui/src/hooks/use-media-collection-selection.ts"]
  N799["packages/ui/src/hooks/stable-media-results.ts"]
  N800["packages/ui/src/import-inbox-helpers.ts"]
  N801["packages/ui/src/input.tsx"]
  N802["packages/ui/src/label.tsx"]
  N803["packages/ui/src/layouts/app-shell.tsx"]
  N804["packages/ui/src/layouts/command-center.tsx"]
  N805["packages/ui/src/layouts/mobile-header.tsx"]
  N806["packages/ui/src/workspace/icons.tsx"]
  N807["packages/ui/src/layouts/navigation.tsx"]
  N808["packages/ui/src/layouts/sidebar.tsx"]
  N809["packages/ui/src/shortcuts/index.ts"]
  N810["packages/ui/src/layouts/source-list.tsx"]
  N811["packages/ui/src/media-card-item.tsx"]
  N812["packages/ui/src/import-review-modal.tsx"]
  N813["packages/ui/src/media-list-actions.tsx"]
  N814["packages/ui/src/tauri-media-grid-item.tsx"]
  N815["packages/ui/src/media-sidebar.tsx"]
  N816["packages/ui/src/move-copy-media-dialog.tsx"]
  N817["packages/ui/src/pagination-controls.tsx"]
  N818["packages/ui/src/upload-media-modal.tsx"]
  N819["node_modules/@tanstack/solid-form/dist/cjs/index.cjs"]
  N820["packages/ui/src/popover.tsx"]
  N821["npm:@kobalte/core/popover"]
  N822["packages/ui/src/preset-client.ts"]
  N823["packages/ui/src/pro-search-builder.tsx"]
  N824["packages/ui/src/pro-search-dialog.tsx"]
  N825["packages/ui/src/query-options/authors-query.ts"]
  N826["packages/ui/src/query-options/characters-query.ts"]
  N827["packages/ui/src/query-options/config-query.ts"]
  N828["packages/ui/src/query-options/ips-query.ts"]
  N829["packages/ui/src/query-options/media-query.ts"]
  N830["npm:@solid-imager/core/domain/shared/schemas"]
  N831["packages/ui/src/query-options/projects-query.ts"]
  N832["packages/ui/src/query-options/sources-query.ts"]
  N833["packages/ui/src/query-options/tags-query.ts"]
  N834["packages/ui/src/query-options/prefetch.ts"]
  N835["packages/ui/src/query-options/query-client.test.ts"]
  N836["packages/ui/src/query-options/query-client.ts"]
  N837["packages/ui/src/query-options/jobs-query.test.ts"]
  N838["packages/ui/src/query-options/jobs-query.ts"]
  N839["packages/ui/src/screens/config-screen.tsx"]
  N840["npm:lucide-solid/icons/bot"]
  N841["npm:lucide-solid/icons/briefcase-business"]
  N842["npm:lucide-solid/icons/cloud-download"]
  N843["npm:lucide-solid/icons/hard-drive"]
  N844["npm:lucide-solid/icons/image"]
  N845["npm:lucide-solid/icons/keyboard"]
  N846["npm:lucide-solid/icons/logs"]
  N847["packages/ui/src/screens/config-state-screen.tsx"]
  N848["packages/ui/src/async-state.tsx"]
  N849["packages/ui/src/skeleton.tsx"]
  N850["packages/ui/src/workspace/management-layout.tsx"]
  N851["packages/ui/src/screens/config-state-screen.types.ts"]
  N852["packages/ui/src/screens/media-detail-screen.tsx"]
  N853["packages/ui/src/media-detail-skeleton.tsx"]
  N854["packages/ui/src/screens/media-detail-screen.types.ts"]
  N855["packages/ui/src/screens/media-detail-screen-core.tsx"]
  N856["packages/ui/src/screens/not-found-screen.tsx"]
  N857["packages/ui/src/screens/manager-screen.tsx"]
  N858["packages/ui/src/screens/search-screen.tsx"]
  N859["packages/ui/src/screens/source-media-screen.tsx"]
  N860["npm:lucide-solid/icons/upload"]
  N861["packages/ui/src/query-state.ts"]
  N862["packages/ui/src/screens/design-concept-screen.tsx"]
  N863["npm:lucide-solid/icons/arrow-down-up"]
  N864["npm:lucide-solid/icons/arrow-left"]
  N865["npm:lucide-solid/icons/ban"]
  N866["npm:lucide-solid/icons/chevron-down"]
  N867["npm:lucide-solid/icons/chevron-left"]
  N868["npm:lucide-solid/icons/chevron-right"]
  N869["npm:lucide-solid/icons/circle-alert"]
  N870["npm:lucide-solid/icons/circle-check"]
  N871["npm:lucide-solid/icons/clock-3"]
  N872["npm:lucide-solid/icons/database"]
  N873["npm:lucide-solid/icons/download"]
  N874["npm:lucide-solid/icons/external-link"]
  N875["npm:lucide-solid/icons/filter"]
  N876["npm:lucide-solid/icons/folder"]
  N877["npm:lucide-solid/icons/grid-3-x-3"]
  N878["npm:lucide-solid/icons/inbox"]
  N879["npm:lucide-solid/icons/library"]
  N880["npm:lucide-solid/icons/list"]
  N881["npm:lucide-solid/icons/panel-left-close"]
  N882["npm:lucide-solid/icons/panel-left-open"]
  N883["npm:lucide-solid/icons/panels-top-left"]
  N884["npm:lucide-solid/icons/plus"]
  N885["npm:lucide-solid/icons/refresh-cw"]
  N886["npm:lucide-solid/icons/rotate-ccw"]
  N887["npm:lucide-solid/icons/search"]
  N888["npm:lucide-solid/icons/settings"]
  N889["npm:lucide-solid/icons/share-2"]
  N890["npm:lucide-solid/icons/trash-2"]
  N891["npm:lucide-solid/icons/x"]
  N892["packages/ui/src/screens/tauri-manager-screen.tsx"]
  N893["packages/ui/src/screens/search-screen.types.ts"]
  N894["packages/ui/src/screens/source-media-screen.types.ts"]
  N895["packages/ui/src/screens/jobs-selection.test.ts"]
  N896["packages/ui/src/screens/jobs-selection.ts"]
  N897["packages/ui/src/screens/tauri-search-screen.tsx"]
  N898["packages/ui/src/mobile-search-filter-dialog.tsx"]
  N899["packages/ui/src/search-control-panel.tsx"]
  N900["packages/ui/src/source-media-grid.tsx"]
  N901["packages/ui/src/screens/tauri-source-media-screen.tsx"]
  N902["packages/ui/src/screens/tauri-media-detail-screen.tsx"]
  N903["packages/ui/src/media-detail-layout-skeleton.tsx"]
  N904["packages/ui/src/screens/manager/batch-tools.tsx"]
  N905["packages/ui/src/screens/manager/job-status.tsx"]
  N906["packages/ui/src/screens/manager/source-select.tsx"]
  N907["packages/ui/src/screens/manager/data-transfer.tsx"]
  N908["packages/ui/src/screens/manager/dialogs.tsx"]
  N909["packages/ui/src/screens/manager/duplicates.tsx"]
  N910["packages/ui/src/screens/manager/entity-panel.tsx"]
  N911["npm:lucide-solid/icons/pencil"]
  N912["packages/ui/src/progress.tsx"]
  N913["packages/ui/src/screens/manager/navigation.tsx"]
  N914["npm:lucide-solid/icons/copy-check"]
  N915["packages/ui/src/screens/manager/thumbnail.tsx"]
  N916["packages/ui/src/screens/manager/types.ts"]
  N917["packages/ui/src/screens/manager/utils.test.ts"]
  N918["packages/ui/src/screens/manager/utils.ts"]
  N919["packages/ui/src/screens/tauri-config-screen.tsx"]
  N920["packages/ui/src/screens/tauri-config-state-screen.tsx"]
  N921["npm:@solid-imager/core/domain/search/schema"]
  N922["packages/ui/src/preset-manager.tsx"]
  N923["packages/ui/src/search-filters.tsx"]
  N924["packages/ui/src/select.tsx"]
  N925["packages/ui/src/sort-controls.tsx"]
  N926["packages/ui/src/source-delete-modal.tsx"]
  N927["packages/ui/src/media-grid-item.tsx"]
  N928["packages/ui/src/source-media-page.tsx"]
  N929["packages/ui/src/stores/search-store.ts"]
  N930["packages/ui/src/stores/search-store.test.ts"]
  N931["packages/ui/src/switch.tsx"]
  N932["packages/ui/src/tabs.tsx"]
  N933["packages/ui/src/textarea.tsx"]
  N934["packages/ui/src/thumbnail-image.tsx"]
  N935["packages/ui/src/thumbnail-source.ts"]
  N936["node_modules/clsx/dist/clsx.js"]
  N937["node_modules/tailwind-merge/dist/types.d.ts"]
  N938["packages/ui/src/utils/debounce.ts"]
  N939["packages/ui/src/event-stream.test.ts"]
  N940["packages/ui/src/form-message.tsx"]
  N941["packages/ui/src/form-schemas.test.ts"]
  N942["packages/ui/src/form-schemas.ts"]
  N943["packages/ui/src/oppai-oracle-modal.tsx"]
  N944["packages/ui/src/query-state.test.ts"]
  N945["packages/ui/src/router-status.tsx"]
  N946["packages/ui/src/screen-skeleton.tsx"]
  N947["packages/ui/src/text-field.tsx"]
  N948["npm:@kobalte/core/text-field"]
  N949["packages/ui/src/import-review-modal.types.ts"]
  N950["packages/ui/src/media-sidebar-content.tsx"]
  N951["packages/ui/src/media-preview-selection.test.ts"]
  N952["packages/ui/src/media-preview-selection.ts"]
  N953["packages/ui/src/pending-downloads-indicator-core.tsx"]
  N954["packages/ui/src/pending-downloads-indicator.types.ts"]
  N955["packages/ui/src/thumbnail-source.test.ts"]
  N956["packages/ui/src/pending-downloads-indicator.tsx"]
  N957["packages/ui/src/tauri-import-review-modal.tsx"]
  N958["packages/ui/src/route-compat.test.ts"]
  N959["packages/ui/src/route-compat.ts"]
  N960["packages/ui/src/workspace/collection-inspector.tsx"]
  N961["packages/ui/src/workspace/collection-navigation.test.ts"]
  N962["packages/ui/src/workspace/search-composer-utils.ts"]
  N963["packages/ui/src/workspace/search-composer.test.ts"]
  N964["packages/ui/src/workspace/search-composer.tsx"]
  N965["packages/ui/src/workspace/search-toolbar.tsx"]
  N966["packages/ui/src/shortcuts/create-app-shortcut.ts"]
  N967["packages/ui/src/tauri-pending-downloads-indicator.tsx"]
  N968["packages/ui/src/search-history-client.ts"]
  N969["packages/ui/src/search-history-route.ts"]
  N970["packages/ui/src/shortcuts/definitions.ts"]
  N971["node_modules/@tanstack/solid-hotkeys/dist/index.js"]
  N972["packages/ui/src/shortcuts/preferences-provider.tsx"]
  N973["packages/ui/src/shortcuts/preferences-storage.test.ts"]
  N974["packages/ui/src/shortcuts/shortcut-kbd.tsx"]
  N975["packages/ui/src/shortcuts/preferences-storage.ts"]
  N976["packages/ui/src/import-source-preference.ts"]
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
  N21 --> N22
  N21 --> N23
  N21 --> N24
  N21 --> N25
  N26 --> N27
  N26 --> N28
  N26 --> N29
  N30 --> N31
  N30 --> N27
  N30 --> N32
  N33 --> N31
  N33 --> N27
  N34 --> N35
  N34 --> N27
  N36 --> N37
  N36 --> N38
  N36 --> N39
  N36 --> N40
  N36 --> N41
  N36 --> N42
  N43 --> N44
  N43 --> N45
  N46 --> N47
  N46 --> N37
  N46 --> N48
  N46 --> N49
  N46 --> N50
  N46 --> N40
  N46 --> N51
  N52 --> N53
  N52 --> N27
  N52 --> N54
  N55 --> N53
  N55 --> N18
  N55 --> N27
  N56 --> N57
  N56 --> N58
  N58 --> N59
  N60 --> N61
  N60 --> N62
  N63 --> N35
  N63 --> N27
  N64 --> N31
  N64 --> N27
  N65 --> N53
  N65 --> N66
  N65 --> N62
  N67 --> N68
  N67 --> N69
  N67 --> N70
  N67 --> N53
  N67 --> N71
  N67 --> N72
  N67 --> N35
  N67 --> N27
  N73 --> N53
  N73 --> N18
  N74 --> N53
  N75 --> N53
  N76 --> N31
  N76 --> N77
  N76 --> N78
  N76 --> N79
  N80 --> N81
  N80 --> N82
  N80 --> N83
  N84 --> N68
  N84 --> N69
  N84 --> N70
  N85 --> N68
  N85 --> N69
  N85 --> N70
  N85 --> N53
  N85 --> N71
  N85 --> N72
  N85 --> N27
  N86 --> N68
  N86 --> N69
  N86 --> N70
  N86 --> N71
  N86 --> N31
  N86 --> N72
  N86 --> N27
  N86 --> N87
  N88 --> N53
  N88 --> N18
  N89 --> N87
  N90 --> N53
  N90 --> N91
  N92 --> N93
  N92 --> N62
  N94 --> N53
  N95 --> N27
  N95 --> N78
  N96 --> N40
  N97 --> N27
  N97 --> N28
  N97 --> N23
  N98 --> N78
  N98 --> N99
  N98 --> N100
  N101 --> N102
  N101 --> N103
  N104 --> N105
  N104 --> N23
  N104 --> N78
  N104 --> N106
  N107 --> N9
  N107 --> N10
  N107 --> N108
  N109 --> N110
  N109 --> N10
  N109 --> N111
  N109 --> N112
  N109 --> N17
  N109 --> N113
  N114 --> N112
  N114 --> N115
  N116 --> N117
  N116 --> N108
  N116 --> N41
  N118 --> N119
  N118 --> N111
  N118 --> N17
  N118 --> N120
  N118 --> N121
  N118 --> N122
  N123 --> N41
  N124 --> N53
  N124 --> N41
  N125 --> N41
  N126 --> N41
  N127 --> N41
  N127 --> N128
  N129 --> N41
  N130 --> N131
  N130 --> N44
  N128 --> N53
  N128 --> N41
  N132 --> N111
  N132 --> N31
  N132 --> N108
  N132 --> N41
  N133 --> N41
  N134 --> N135
  N134 --> N41
  N136 --> N137
  N136 --> N41
  N138 --> N110
  N138 --> N10
  N138 --> N119
  N139 --> N119
  N139 --> N140
  N139 --> N141
  N142 --> N119
  N142 --> N143
  N142 --> N144
  N145 --> N119
  N145 --> N146
  N145 --> N147
  N145 --> N148
  N149 --> N119
  N149 --> N150
  N149 --> N151
  N152 --> N119
  N152 --> N153
  N152 --> N154
  N155 --> N119
  N155 --> N156
  N155 --> N157
  N158 --> N119
  N158 --> N159
  N158 --> N53
  N158 --> N160
  N158 --> N161
  N158 --> N108
  N158 --> N162
  N158 --> N163
  N158 --> N164
  N158 --> N157
  N158 --> N165
  N166 --> N119
  N166 --> N167
  N166 --> N168
  N166 --> N148
  N169 --> N119
  N169 --> N170
  N169 --> N171
  N169 --> N172
  N169 --> N173
  N169 --> N174
  N169 --> N175
  N169 --> N176
  N177 --> N119
  N177 --> N178
  N177 --> N179
  N180 --> N119
  N180 --> N181
  N180 --> N182
  N180 --> N148
  N183 --> N184
  N183 --> N119
  N185 --> N119
  N185 --> N186
  N185 --> N187
  N188 --> N119
  N188 --> N189
  N188 --> N190
  N191 --> N119
  N191 --> N192
  N193 --> N119
  N193 --> N194
  N148 --> N161
  N148 --> N162
  N195 --> N119
  N195 --> N196
  N195 --> N197
  N195 --> N198
  N199 --> N9
  N199 --> N200
  N199 --> N201
  N199 --> N202
  N199 --> N203
  N199 --> N204
  N205 --> N206
  N205 --> N119
  N205 --> N17
  N205 --> N207
  N205 --> N208
  N205 --> N209
  N205 --> N210
  N205 --> N211
  N205 --> N212
  N205 --> N213
  N205 --> N214
  N205 --> N215
  N205 --> N216
  N205 --> N217
  N205 --> N218
  N205 --> N219
  N205 --> N220
  N205 --> N221
  N205 --> N222
  N205 --> N223
  N205 --> N224
  N225 --> N226
  N225 --> N227
  N225 --> N164
  N225 --> N228
  N225 --> N229
  N225 --> N230
  N231 --> N232
  N231 --> N1
  N231 --> N163
  N233 --> N234
  N233 --> N235
  N233 --> N236
  N233 --> N237
  N233 --> N238
  N233 --> N239
  N240 --> N161
  N240 --> N241
  N242 --> N243
  N242 --> N241
  N244 --> N10
  N244 --> N234
  N244 --> N235
  N244 --> N245
  N244 --> N246
  N244 --> N247
  N244 --> N236
  N244 --> N173
  N244 --> N238
  N244 --> N239
  N244 --> N248
  N238 --> N234
  N238 --> N249
  N250 --> N200
  N250 --> N251
  N252 --> N200
  N252 --> N110
  N252 --> N10
  N253 --> N112
  N254 --> N10
  N254 --> N164
  N254 --> N255
  N254 --> N256
  N254 --> N173
  N254 --> N257
  N254 --> N258
  N254 --> N151
  N254 --> N175
  N254 --> N259
  N254 --> N260
  N254 --> N261
  N262 --> N263
  N264 --> N112
  N264 --> N265
  N264 --> N163
  N264 --> N164
  N264 --> N173
  N266 --> N117
  N266 --> N161
  N266 --> N108
  N266 --> N162
  N267 --> N268
  N267 --> N269
  N270 --> N200
  N270 --> N10
  N270 --> N117
  N271 --> N10
  N271 --> N272
  N271 --> N164
  N271 --> N173
  N273 --> N274
  N275 --> N276
  N277 --> N276
  N278 --> N279
  N278 --> N280
  N278 --> N281
  N282 --> N283
  N282 --> N284
  N282 --> N281
  N285 --> N286
  N285 --> N287
  N285 --> N281
  N288 --> N289
  N288 --> N290
  N288 --> N281
  N291 --> N292
  N291 --> N293
  N291 --> N281
  N294 --> N295
  N294 --> N296
  N294 --> N281
  N297 --> N201
  N298 --> N299
  N298 --> N281
  N300 --> N301
  N300 --> N302
  N300 --> N299
  N300 --> N281
  N300 --> N173
  N300 --> N303
  N300 --> N269
  N304 --> N305
  N304 --> N306
  N304 --> N281
  N307 --> N308
  N307 --> N309
  N307 --> N281
  N310 --> N311
  N310 --> N312
  N310 --> N281
  N313 --> N314
  N313 --> N315
  N313 --> N281
  N316 --> N317
  N316 --> N318
  N316 --> N281
  N319 --> N320
  N319 --> N321
  N319 --> N281
  N322 --> N31
  N322 --> N323
  N322 --> N324
  N323 --> N9
  N323 --> N200
  N323 --> N10
  N323 --> N31
  N323 --> N324
  N324 --> N9
  N324 --> N13
  N325 --> N200
  N325 --> N10
  N326 --> N327
  N326 --> N173
  N328 --> N13
  N329 --> N330
  N331 --> N40
  N332 --> N225
  N333 --> N334
  N333 --> N303
  N335 --> N9
  N335 --> N200
  N335 --> N10
  N335 --> N13
  N335 --> N14
  N336 --> N53
  N336 --> N256
  N336 --> N173
  N336 --> N151
  N337 --> N338
  N337 --> N339
  N340 --> N341
  N340 --> N342
  N340 --> N343
  N340 --> N162
  N340 --> N151
  N340 --> N344
  N345 --> N346
  N345 --> N347
  N348 --> N349
  N348 --> N350
  N351 --> N200
  N351 --> N10
  N351 --> N31
  N351 --> N164
  N351 --> N256
  N351 --> N173
  N351 --> N257
  N351 --> N258
  N351 --> N151
  N351 --> N175
  N351 --> N260
  N352 --> N353
  N352 --> N354
  N355 --> N341
  N355 --> N201
  N355 --> N164
  N356 --> N9
  N356 --> N200
  N356 --> N10
  N356 --> N14
  N356 --> N201
  N356 --> N204
  N357 --> N200
  N357 --> N10
  N357 --> N301
  N357 --> N311
  N357 --> N265
  N357 --> N256
  N357 --> N173
  N358 --> N359
  N358 --> N53
  N358 --> N201
  N358 --> N151
  N360 --> N361
  N360 --> N362
  N360 --> N305
  N360 --> N363
  N364 --> N365
  N364 --> N366
  N367 --> N368
  N367 --> N151
  N369 --> N361
  N369 --> N370
  N369 --> N320
  N369 --> N371
  N372 --> N9
  N372 --> N200
  N372 --> N10
  N372 --> N373
  N372 --> N251
  N374 --> N9
  N374 --> N200
  N374 --> N10
  N374 --> N14
  N375 --> N376
  N375 --> N269
  N377 --> N378
  N377 --> N164
  N377 --> N173
  N377 --> N151
  N379 --> N380
  N381 --> N382
  N381 --> N383
  N384 --> N111
  N384 --> N37
  N385 --> N23
  N385 --> N386
  N387 --> N32
  N387 --> N50
  N387 --> N40
  N388 --> N23
  N388 --> N389
  N390 --> N391
  N390 --> N392
  N390 --> N23
  N390 --> N122
  N390 --> N393
  N390 --> N173
  N390 --> N394
  N390 --> N395
  N396 --> N10
  N396 --> N397
  N396 --> N31
  N396 --> N23
  N396 --> N394
  N396 --> N395
  N396 --> N151
  N398 --> N23
  N399 --> N380
  N399 --> N23
  N400 --> N23
  N401 --> N23
  N401 --> N402
  N403 --> N23
  N403 --> N404
  N405 --> N23
  N406 --> N23
  N406 --> N386
  N407 --> N23
  N407 --> N408
  N409 --> N410
  N409 --> N23
  N411 --> N23
  N411 --> N412
  N413 --> N414
  N413 --> N415
  N413 --> N416
  N413 --> N23
  N413 --> N78
  N417 --> N53
  N417 --> N27
  N417 --> N418
  N419 --> N410
  N419 --> N23
  N419 --> N413
  N420 --> N23
  N420 --> N386
  N421 --> N422
  N421 --> N23
  N423 --> N1
  N423 --> N163
  N424 --> N1
  N424 --> N163
  N425 --> N1
  N425 --> N163
  N426 --> N1
  N426 --> N163
  N427 --> N53
  N427 --> N1
  N427 --> N108
  N427 --> N163
  N428 --> N53
  N428 --> N31
  N428 --> N1
  N428 --> N108
  N429 --> N53
  N429 --> N31
  N429 --> N1
  N429 --> N108
  N429 --> N163
  N430 --> N53
  N430 --> N31
  N430 --> N1
  N430 --> N108
  N430 --> N163
  N431 --> N1
  N431 --> N163
  N432 --> N1
  N432 --> N163
  N433 --> N434
  N433 --> N435
  N436 --> N434
  N437 --> N434
  N438 --> N184
  N438 --> N200
  N438 --> N10
  N438 --> N434
  N439 --> N434
  N440 --> N435
  N441 --> N184
  N441 --> N200
  N441 --> N10
  N442 --> N434
  N442 --> N443
  N442 --> N435
  N444 --> N434
  N443 --> N10
  N435 --> N434
  N445 --> N434
  N446 --> N447
  N446 --> N448
  N446 --> N449
  N446 --> N450
  N446 --> N451
  N446 --> N452
  N446 --> N453
  N454 --> N53
  N455 --> N10
  N455 --> N456
  N455 --> N457
  N455 --> N276
  N455 --> N458
  N455 --> N459
  N460 --> N434
  N461 --> N434
  N462 --> N434
  N462 --> N443
  N462 --> N435
  N463 --> N200
  N463 --> N161
  N463 --> N1
  N463 --> N162
  N464 --> N161
  N464 --> N1
  N464 --> N162
  N465 --> N9
  N465 --> N200
  N465 --> N110
  N465 --> N10
  N465 --> N14
  N465 --> N161
  N465 --> N1
  N465 --> N162
  N466 --> N9
  N466 --> N10
  N466 --> N1
  N466 --> N237
  N467 --> N1
  N467 --> N226
  N467 --> N268
  N467 --> N303
  N467 --> N468
  N467 --> N354
  N467 --> N257
  N467 --> N366
  N467 --> N258
  N467 --> N269
  N467 --> N151
  N467 --> N176
  N467 --> N261
  N469 --> N161
  N469 --> N1
  N469 --> N241
  N469 --> N163
  N469 --> N257
  N470 --> N161
  N470 --> N1
  N470 --> N241
  N471 --> N161
  N471 --> N1
  N471 --> N108
  N471 --> N226
  N471 --> N241
  N471 --> N163
  N471 --> N268
  N471 --> N303
  N471 --> N468
  N471 --> N354
  N471 --> N257
  N471 --> N366
  N471 --> N258
  N471 --> N269
  N471 --> N151
  N471 --> N176
  N471 --> N261
  N472 --> N200
  N472 --> N10
  N473 --> N1
  N473 --> N108
  N473 --> N226
  N473 --> N241
  N473 --> N163
  N473 --> N268
  N473 --> N303
  N473 --> N468
  N473 --> N354
  N473 --> N257
  N473 --> N366
  N473 --> N258
  N473 --> N269
  N473 --> N151
  N473 --> N176
  N473 --> N261
  N474 --> N1
  N474 --> N108
  N474 --> N226
  N474 --> N241
  N474 --> N163
  N474 --> N268
  N474 --> N303
  N474 --> N468
  N474 --> N354
  N474 --> N257
  N474 --> N366
  N474 --> N258
  N474 --> N269
  N474 --> N151
  N474 --> N176
  N474 --> N261
  N475 --> N200
  N475 --> N10
  N476 --> N200
  N476 --> N10
  N476 --> N1
  N476 --> N241
  N477 --> N161
  N477 --> N1
  N477 --> N108
  N477 --> N226
  N477 --> N241
  N477 --> N163
  N477 --> N268
  N477 --> N303
  N477 --> N468
  N477 --> N354
  N477 --> N257
  N477 --> N366
  N477 --> N258
  N477 --> N269
  N477 --> N151
  N477 --> N176
  N477 --> N261
  N478 --> N1
  N478 --> N162
  N479 --> N161
  N479 --> N480
  N479 --> N1
  N479 --> N162
  N479 --> N163
  N479 --> N303
  N481 --> N161
  N481 --> N480
  N481 --> N1
  N481 --> N162
  N481 --> N163
  N481 --> N468
  N482 --> N1
  N482 --> N165
  N483 --> N200
  N483 --> N10
  N483 --> N1
  N483 --> N261
  N484 --> N10
  N484 --> N263
  N485 --> N9
  N485 --> N10
  N485 --> N1
  N486 --> N10
  N486 --> N487
  N486 --> N1
  N488 --> N10
  N488 --> N487
  N488 --> N1
  N489 --> N10
  N489 --> N487
  N489 --> N1
  N490 --> N1
  N490 --> N151
  N491 --> N53
  N491 --> N1
  N491 --> N162
  N492 --> N1
  N492 --> N151
  N493 --> N1
  N494 --> N495
  N494 --> N496
  N494 --> N497
  N494 --> N251
  N494 --> N53
  N494 --> N279
  N494 --> N289
  N494 --> N295
  N494 --> N201
  N494 --> N301
  N494 --> N308
  N494 --> N311
  N494 --> N314
  N494 --> N498
  N494 --> N1
  N494 --> N227
  N494 --> N176
  N499 --> N342
  N499 --> N1
  N500 --> N200
  N501 --> N1
  N501 --> N260
  N502 --> N378
  N502 --> N113
  N502 --> N289
  N502 --> N295
  N502 --> N301
  N502 --> N311
  N502 --> N314
  N502 --> N1
  N503 --> N1
  N503 --> N163
  N504 --> N184
  N504 --> N200
  N504 --> N110
  N504 --> N10
  N504 --> N201
  N504 --> N1
  N505 --> N370
  N505 --> N171
  N505 --> N320
  N506 --> N9
  N506 --> N10
  N506 --> N1
  N506 --> N237
  N507 --> N1
  N507 --> N237
  N508 --> N53
  N508 --> N1
  N509 --> N184
  N509 --> N9
  N509 --> N110
  N509 --> N10
  N509 --> N361
  N509 --> N1
  N510 --> N511
  N510 --> N1
  N512 --> N53
  N512 --> N513
  N514 --> N1
  N514 --> N62
  N515 --> N1
  N515 --> N516
  N517 --> N1
  N518 --> N200
  N518 --> N110
  N518 --> N10
  N518 --> N1
  N518 --> N228
  N519 --> N1
  N519 --> N157
  N519 --> N257
  N520 --> N1
  N521 --> N112
  N521 --> N1
  N521 --> N265
  N521 --> N163
  N521 --> N230
  N522 --> N1
  N522 --> N265
  N523 --> N1
  N523 --> N265
  N524 --> N200
  N524 --> N327
  N524 --> N1
  N524 --> N525
  N524 --> N261
  N526 --> N200
  N526 --> N110
  N526 --> N10
  N526 --> N276
  N526 --> N1
  N526 --> N261
  N527 --> N160
  N527 --> N1
  N527 --> N164
  N528 --> N119
  N528 --> N391
  N528 --> N392
  N528 --> N1
  N528 --> N108
  N528 --> N393
  N529 --> N1
  N529 --> N530
  N531 --> N200
  N531 --> N110
  N531 --> N10
  N531 --> N276
  N531 --> N1
  N531 --> N268
  N532 --> N1
  N532 --> N256
  N532 --> N257
  N532 --> N151
  N532 --> N176
  N533 --> N1
  N533 --> N176
  N534 --> N9
  N534 --> N200
  N534 --> N112
  N534 --> N1
  N534 --> N535
  N536 --> N387
  N536 --> N406
  N536 --> N385
  N536 --> N388
  N536 --> N401
  N536 --> N421
  N536 --> N403
  N536 --> N407
  N536 --> N409
  N536 --> N420
  N536 --> N390
  N536 --> N405
  N536 --> N419
  N536 --> N398
  N536 --> N396
  N536 --> N411
  N536 --> N399
  N537 --> N538
  N539 --> N538
  N540 --> N31
  N540 --> N108
  N540 --> N538
  N541 --> N542
  N541 --> N22
  N541 --> N543
  N541 --> N78
  N541 --> N544
  N541 --> N545
  N541 --> N546
  N541 --> N547
  N548 --> N549
  N548 --> N550
  N548 --> N551
  N548 --> N552
  N548 --> N538
  N548 --> N553
  N548 --> N554
  N555 --> N549
  N555 --> N550
  N555 --> N551
  N555 --> N552
  N555 --> N538
  N555 --> N553
  N555 --> N554
  N546 --> N552
  N546 --> N548
  N546 --> N555
  N546 --> N556
  N546 --> N557
  N546 --> N558
  N546 --> N559
  N556 --> N549
  N556 --> N550
  N556 --> N551
  N556 --> N552
  N556 --> N538
  N556 --> N553
  N556 --> N554
  N557 --> N549
  N557 --> N550
  N557 --> N551
  N557 --> N552
  N557 --> N538
  N557 --> N553
  N557 --> N554
  N558 --> N549
  N558 --> N550
  N558 --> N551
  N558 --> N552
  N558 --> N538
  N558 --> N553
  N558 --> N554
  N559 --> N549
  N559 --> N550
  N559 --> N551
  N559 --> N552
  N559 --> N538
  N559 --> N553
  N559 --> N554
  N560 --> N561
  N562 --> N59
  N562 --> N563
  N564 --> N61
  N564 --> N41
  N565 --> N53
  N565 --> N66
  N565 --> N41
  N566 --> N53
  N567 --> N53
  N567 --> N568
  N567 --> N416
  N567 --> N543
  N567 --> N78
  N567 --> N51
  N569 --> N53
  N570 --> N31
  N570 --> N77
  N570 --> N78
  N570 --> N79
  N571 --> N53
  N572 --> N573
  N572 --> N562
  N574 --> N102
  N547 --> N35
  N547 --> N27
  N545 --> N20
  N575 --> N538
  N576 --> N538
  N577 --> N538
  N578 --> N538
  N579 --> N538
  N580 --> N53
  N580 --> N538
  N581 --> N41
  N582 --> N135
  N582 --> N538
  N583 --> N137
  N583 --> N538
  N584 --> N551
  N584 --> N585
  N584 --> N586
  N587 --> N588
  N589 --> N590
  N589 --> N591
  N592 --> N590
  N593 --> N594
  N593 --> N108
  N593 --> N595
  N596 --> N597
  N596 --> N17
  N596 --> N590
  N598 --> N131
  N598 --> N44
  N599 --> N597
  N599 --> N37
  N600 --> N105
  N600 --> N601
  N600 --> N543
  N600 --> N78
  N602 --> N542
  N602 --> N22
  N602 --> N32
  N602 --> N50
  N602 --> N543
  N602 --> N603
  N602 --> N553
  N604 --> N35
  N605 --> N37
  N605 --> N38
  N605 --> N606
  N605 --> N40
  N605 --> N543
  N605 --> N41
  N605 --> N607
  N608 --> N35
  N608 --> N27
  N609 --> N597
  N610 --> N27
  N610 --> N418
  N610 --> N611
  N610 --> N612
  N610 --> N81
  N610 --> N613
  N610 --> N415
  N610 --> N410
  N610 --> N416
  N610 --> N543
  N610 --> N614
  N610 --> N615
  N610 --> N83
  N610 --> N616
  N617 --> N618
  N617 --> N37
  N617 --> N22
  N617 --> N619
  N617 --> N40
  N617 --> N543
  N617 --> N620
  N617 --> N621
  N617 --> N615
  N617 --> N607
  N622 --> N618
  N622 --> N81
  N622 --> N623
  N622 --> N415
  N622 --> N624
  N622 --> N416
  N622 --> N543
  N622 --> N614
  N622 --> N625
  N622 --> N626
  N622 --> N615
  N622 --> N83
  N622 --> N616
  N627 --> N410
  N627 --> N543
  N628 --> N31
  N628 --> N59
  N628 --> N629
  N628 --> N630
  N628 --> N38
  N628 --> N631
  N628 --> N632
  N628 --> N633
  N628 --> N634
  N628 --> N635
  N628 --> N40
  N628 --> N543
  N628 --> N636
  N628 --> N637
  N628 --> N41
  N638 --> N543
  N638 --> N639
  N638 --> N586
  N640 --> N602
  N640 --> N608
  N640 --> N600
  N640 --> N604
  N640 --> N605
  N640 --> N609
  N640 --> N641
  N640 --> N610
  N640 --> N638
  N640 --> N628
  N640 --> N627
  N640 --> N617
  N642 --> N643
  N642 --> N17
  N644 --> N645
  N644 --> N646
  N644 --> N647
  N648 --> N649
  N648 --> N650
  N651 --> N649
  N651 --> N648
  N651 --> N652
  N651 --> N653
  N653 --> N649
  N653 --> N650
  N652 --> N649
  N652 --> N650
  N654 --> N1
  N655 --> N656
  N655 --> N448
  N655 --> N449
  N655 --> N450
  N655 --> N451
  N655 --> N452
  N655 --> N657
  N658 --> N647
  N658 --> N649
  N658 --> N659
  N658 --> N78
  N658 --> N544
  N660 --> N108
  N661 --> N1
  N661 --> N662
  N663 --> N359
  N664 --> N359
  N665 --> N70
  N665 --> N295
  N665 --> N666
  N667 --> N10
  N667 --> N69
  N667 --> N359
  N668 --> N10
  N668 --> N669
  N668 --> N171
  N670 --> N359
  N671 --> N10
  N671 --> N669
  N671 --> N171
  N672 --> N10
  N672 --> N669
  N672 --> N171
  N673 --> N10
  N673 --> N113
  N673 --> N289
  N673 --> N295
  N673 --> N301
  N673 --> N311
  N673 --> N314
  N673 --> N160
  N673 --> N31
  N673 --> N674
  N675 --> N317
  N676 --> N184
  N676 --> N171
  N676 --> N320
  N677 --> N184
  N677 --> N9
  N677 --> N14
  N678 --> N679
  N678 --> N680
  N678 --> N681
  N678 --> N682
  N683 --> N1
  N683 --> N682
  N684 --> N1
  N684 --> N682
  N684 --> N678
  N685 --> N108
  N685 --> N686
  N687 --> N108
  N688 --> N108
  N689 --> N108
  N690 --> N108
  N691 --> N681
  N691 --> N108
  N692 --> N681
  N692 --> N685
  N693 --> N681
  N693 --> N108
  N693 --> N687
  N694 --> N681
  N694 --> N108
  N695 --> N681
  N695 --> N690
  N696 --> N681
  N696 --> N108
  N697 --> N681
  N697 --> N108
  N697 --> N686
  N698 --> N681
  N698 --> N108
  N699 --> N691
  N699 --> N692
  N699 --> N693
  N699 --> N694
  N699 --> N695
  N699 --> N696
  N699 --> N697
  N699 --> N698
  N699 --> N700
  N699 --> N701
  N699 --> N702
  N699 --> N703
  N699 --> N704
  N699 --> N705
  N699 --> N706
  N699 --> N707
  N699 --> N708
  N699 --> N709
  N700 --> N681
  N700 --> N108
  N700 --> N710
  N702 --> N681
  N702 --> N108
  N703 --> N681
  N703 --> N108
  N704 --> N681
  N704 --> N108
  N706 --> N681
  N706 --> N108
  N706 --> N711
  N706 --> N712
  N707 --> N681
  N707 --> N108
  N708 --> N681
  N708 --> N108
  N709 --> N681
  N709 --> N108
  N701 --> N681
  N701 --> N108
  N713 --> N681
  N713 --> N703
  N714 --> N681
  N714 --> N705
  N705 --> N681
  N715 --> N108
  N710 --> N108
  N686 --> N108
  N716 --> N108
  N717 --> N686
  N718 --> N719
  N720 --> N108
  N721 --> N722
  N721 --> N719
  N723 --> N724
  N725 --> N726
  N725 --> N722
  N727 --> N722
  N727 --> N728
  N729 --> N722
  N730 --> N722
  N731 --> N722
  N732 --> N722
  N732 --> N719
  N732 --> N733
  N734 --> N735
  N736 --> N108
  N736 --> N719
  N737 --> N108
  N737 --> N736
  N738 --> N108
  N738 --> N739
  N740 --> N108
  N712 --> N108
  N712 --> N741
  N712 --> N742
  N742 --> N108
  N743 --> N744
  N745 --> N108
  N746 --> N747
  N746 --> N748
  N748 --> N108
  N749 --> N108
  N711 --> N108
  N741 --> N108
  N750 --> N751
  N752 --> N108
  N752 --> N739
  N753 --> N747
  N754 --> N171
  N755 --> N68
  N756 --> N44
  N757 --> N171
  N757 --> N53
  N758 --> N171
  N759 --> N1
  N759 --> N760
  N759 --> N756
  N761 --> N320
  N762 --> N201
  N762 --> N161
  N760 --> N245
  N760 --> N246
  N760 --> N247
  N760 --> N762
  N763 --> N117
  N763 --> N78
  N763 --> N764
  N765 --> N18
  N765 --> N78
  N765 --> N764
  N765 --> N766
  N764 --> N767
  N764 --> N78
  N764 --> N768
  N769 --> N78
  N769 --> N768
  N770 --> N53
  N770 --> N117
  N770 --> N78
  N770 --> N771
  N772 --> N78
  N772 --> N773
  N772 --> N768
  N774 --> N775
  N776 --> N777
  N776 --> N778
  N776 --> N779
  N776 --> N78
  N780 --> N781
  N780 --> N782
  N783 --> N78
  N784 --> N1
  N785 --> N69
  N785 --> N70
  N785 --> N53
  N785 --> N71
  N786 --> N69
  N786 --> N70
  N787 --> N1
  N787 --> N788
  N789 --> N69
  N789 --> N70
  N789 --> N44
  N790 --> N1
  N790 --> N791
  N791 --> N31
  N791 --> N40
  N792 --> N160
  N792 --> N1
  N793 --> N78
  N793 --> N1
  N794 --> N78
  N794 --> N544
  N795 --> N160
  N795 --> N78
  N795 --> N544
  N795 --> N796
  N797 --> N1
  N798 --> N78
  N799 --> N53
  N799 --> N40
  N799 --> N78
  N799 --> N744
  N800 --> N53
  N800 --> N31
  N801 --> N78
  N801 --> N768
  N802 --> N78
  N802 --> N768
  N803 --> N78
  N804 --> N23
  N805 --> N78
  N805 --> N766
  N805 --> N806
  N807 --> N23
  N807 --> N78
  N808 --> N31
  N808 --> N23
  N808 --> N78
  N808 --> N766
  N808 --> N809
  N810 --> N31
  N810 --> N23
  N810 --> N78
  N810 --> N766
  N811 --> N53
  N811 --> N78
  N811 --> N769
  N811 --> N771
  N811 --> N768
  N812 --> N18
  N813 --> N23
  N813 --> N78
  N813 --> N544
  N813 --> N766
  N814 --> N53
  N814 --> N78
  N814 --> N768
  N815 --> N69
  N815 --> N70
  N815 --> N53
  N815 --> N71
  N816 --> N78
  N816 --> N766
  N817 --> N766
  N818 --> N18
  N818 --> N819
  N818 --> N78
  N818 --> N108
  N820 --> N778
  N820 --> N821
  N820 --> N78
  N820 --> N768
  N822 --> N135
  N823 --> N68
  N823 --> N69
  N823 --> N70
  N824 --> N68
  N824 --> N69
  N824 --> N70
  N824 --> N53
  N824 --> N71
  N824 --> N72
  N824 --> N78
  N824 --> N766
  N825 --> N68
  N825 --> N40
  N826 --> N69
  N826 --> N40
  N827 --> N112
  N827 --> N40
  N828 --> N70
  N828 --> N40
  N829 --> N53
  N829 --> N830
  N829 --> N40
  N831 --> N71
  N831 --> N40
  N832 --> N31
  N832 --> N40
  N833 --> N72
  N833 --> N40
  N834 --> N544
  N835 --> N40
  N835 --> N1
  N836 --> N40
  N837 --> N44
  N837 --> N1
  N837 --> N838
  N839 --> N112
  N839 --> N117
  N839 --> N819
  N839 --> N23
  N839 --> N840
  N839 --> N841
  N839 --> N842
  N839 --> N843
  N839 --> N844
  N839 --> N845
  N839 --> N846
  N839 --> N78
  N839 --> N108
  N847 --> N117
  N847 --> N78
  N847 --> N848
  N847 --> N849
  N847 --> N768
  N847 --> N850
  N847 --> N839
  N847 --> N851
  N852 --> N853
  N852 --> N849
  N852 --> N854
  N852 --> N855
  N856 --> N23
  N857 --> N78
  N858 --> N53
  N858 --> N78
  N858 --> N848
  N858 --> N766
  N858 --> N798
  N858 --> N849
  N859 --> N860
  N859 --> N78
  N859 --> N848
  N859 --> N766
  N851 --> N112
  N851 --> N861
  N862 --> N863
  N862 --> N864
  N862 --> N865
  N862 --> N840
  N862 --> N841
  N862 --> N866
  N862 --> N867
  N862 --> N868
  N862 --> N869
  N862 --> N870
  N862 --> N871
  N862 --> N842
  N862 --> N872
  N862 --> N873
  N862 --> N874
  N862 --> N875
  N862 --> N876
  N862 --> N877
  N862 --> N843
  N862 --> N844
  N862 --> N878
  N862 --> N879
  N862 --> N880
  N862 --> N846
  N862 --> N881
  N862 --> N882
  N862 --> N883
  N862 --> N884
  N862 --> N885
  N862 --> N886
  N862 --> N887
  N862 --> N888
  N862 --> N889
  N862 --> N890
  N862 --> N891
  N892 --> N70
  N892 --> N53
  N892 --> N78
  N855 --> N53
  N854 --> N53
  N893 --> N53
  N893 --> N31
  N894 --> N53
  N894 --> N78
  N894 --> N798
  N895 --> N44
  N895 --> N1
  N896 --> N44
  N897 --> N23
  N897 --> N78
  N897 --> N848
  N897 --> N769
  N897 --> N898
  N897 --> N899
  N897 --> N849
  N897 --> N900
  N897 --> N893
  N901 --> N23
  N901 --> N78
  N901 --> N848
  N901 --> N766
  N901 --> N769
  N902 --> N903
  N902 --> N849
  N902 --> N854
  N902 --> N855
  N904 --> N78
  N904 --> N766
  N904 --> N771
  N904 --> N785
  N904 --> N802
  N904 --> N905
  N904 --> N906
  N907 --> N873
  N907 --> N860
  N907 --> N78
  N907 --> N766
  N907 --> N771
  N907 --> N785
  N907 --> N801
  N907 --> N802
  N908 --> N70
  N908 --> N78
  N909 --> N78
  N909 --> N766
  N909 --> N785
  N909 --> N802
  N910 --> N911
  N910 --> N884
  N910 --> N887
  N910 --> N890
  N910 --> N78
  N910 --> N848
  N910 --> N766
  N905 --> N78
  N905 --> N764
  N905 --> N785
  N905 --> N912
  N913 --> N840
  N913 --> N914
  N913 --> N876
  N913 --> N844
  N913 --> N889
  N913 --> N78
  N913 --> N766
  N906 --> N785
  N915 --> N78
  N915 --> N766
  N915 --> N785
  N915 --> N802
  N915 --> N905
  N915 --> N906
  N916 --> N785
  N917 --> N1
  N917 --> N918
  N918 --> N69
  N918 --> N70
  N919 --> N112
  N919 --> N819
  N919 --> N78
  N919 --> N108
  N919 --> N766
  N920 --> N78
  N920 --> N848
  N920 --> N849
  N920 --> N768
  N920 --> N851
  N920 --> N919
  N899 --> N68
  N899 --> N69
  N899 --> N70
  N899 --> N71
  N899 --> N513
  N899 --> N921
  N899 --> N31
  N899 --> N72
  N899 --> N78
  N899 --> N744
  N899 --> N766
  N899 --> N802
  N899 --> N922
  N899 --> N824
  N899 --> N923
  N923 --> N68
  N923 --> N69
  N923 --> N70
  N923 --> N71
  N923 --> N921
  N923 --> N72
  N923 --> N78
  N923 --> N744
  N923 --> N764
  N923 --> N766
  N924 --> N778
  N925 --> N53
  N925 --> N78
  N925 --> N766
  N925 --> N801
  N925 --> N802
  N926 --> N766
  N927 --> N53
  N927 --> N78
  N927 --> N768
  N900 --> N53
  N928 --> N69
  N928 --> N70
  N929 --> N53
  N930 --> N1
  N931 --> N775
  N932 --> N775
  N933 --> N78
  N933 --> N768
  N934 --> N78
  N935 --> N53
  N935 --> N78
  N935 --> N934
  N773 --> N78
  N773 --> N544
  N768 --> N936
  N768 --> N937
  N938 --> N78
  N848 --> N78
  N848 --> N544
  N848 --> N766
  N848 --> N861
  N848 --> N768
  N939 --> N1
  N939 --> N796
  N940 --> N78
  N940 --> N768
  N941 --> N1
  N942 --> N108
  N943 --> N117
  N943 --> N78
  N943 --> N764
  N944 --> N1
  N944 --> N861
  N945 --> N23
  N945 --> N78
  N945 --> N848
  N945 --> N946
  N946 --> N78
  N946 --> N903
  N849 --> N78
  N849 --> N769
  N849 --> N768
  N947 --> N775
  N947 --> N948
  N947 --> N767
  N947 --> N78
  N947 --> N768
  N949 --> N53
  N949 --> N31
  N903 --> N849
  N903 --> N768
  N950 --> N69
  N950 --> N70
  N950 --> N53
  N950 --> N71
  N951 --> N1
  N951 --> N952
  N953 --> N18
  N954 --> N160
  N954 --> N31
  N954 --> N949
  N955 --> N78
  N955 --> N1
  N956 --> N78
  N956 --> N812
  N956 --> N954
  N956 --> N953
  N956 --> N768
  N957 --> N18
  N853 --> N849
  N853 --> N768
  N958 --> N1
  N958 --> N959
  N960 --> N53
  N960 --> N874
  N960 --> N891
  N960 --> N78
  N960 --> N766
  N961 --> N1
  N806 --> N78
  N850 --> N78
  N962 --> N53
  N962 --> N921
  N962 --> N786
  N963 --> N921
  N963 --> N1
  N963 --> N786
  N964 --> N887
  N964 --> N78
  N965 --> N921
  N965 --> N31
  N965 --> N863
  N965 --> N866
  N965 --> N875
  N965 --> N877
  N965 --> N880
  N965 --> N78
  N965 --> N766
  N965 --> N820
  N965 --> N899
  N965 --> N966
  N965 --> N925
  N965 --> N900
  N967 --> N78
  N967 --> N954
  N967 --> N953
  N967 --> N957
  N968 --> N137
  N969 --> N108
  N970 --> N971
  N972 --> N971
  N973 --> N1
  N973 --> N970
  N974 --> N971
  N974 --> N78
  N974 --> N768
  N974 --> N970
  N974 --> N972
  N974 --> N975
  N976 --> N31
```
