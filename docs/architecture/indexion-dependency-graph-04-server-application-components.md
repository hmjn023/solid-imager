# solid-imager detail 04 - server components and root modules

## Diagram 1

```mermaid
graph LR
  N0["apps/server/src/app.css"]
  N1["url:"]
  N2["apps/server/src/components/layout/app-shell.tsx"]
  N3["npm:@solid-imager/core/domain/sources/schemas"]
  N4["npm:@solid-imager/ui/hooks/use-sources-page"]
  N5["npm:@solid-imager/ui/layouts/app-shell"]
  N6["node_modules/@tanstack/solid-query/build/index.cjs"]
  N7["node_modules/@tanstack/solid-router/dist/cjs/index.cjs"]
  N8["node_modules/solid-js/types/index.d.ts"]
  N9["npm:~/components/imports/pending-downloads-indicator"]
  N10["npm:~/hooks/use-media-source-events"]
  N11["npm:~/infrastructure/api-clients/queries"]
  N12["apps/server/src/components/layout/layout.tsx"]
  N13["npm:@solid-imager/ui/router-status"]
  N14["npm:~/components/api-activity-indicator"]
  N15["apps/server/src/components/pages/about-page.tsx"]
  N16["npm:@solid-imager/ui/screens/about-screen"]
  N17["apps/server/src/components/pages/config-page.tsx"]
  N18["npm:@solid-imager/ui/query-options"]
  N19["npm:@solid-imager/ui/query-state"]
  N20["npm:@solid-imager/ui/screens/config-state-screen"]
  N21["npm:~/infrastructure/api-clients/orpc-client"]
  N22["apps/server/src/components/pages/jobs-page.tsx"]
  N23["npm:@solid-imager/core/domain/jobs/schemas"]
  N24["npm:@solid-imager/ui/hooks/use-job-events"]
  N25["apps/server/src/components/pages/manager-page.tsx"]
  N26["npm:@solid-imager/ui/hooks/use-manager-page"]
  N27["npm:@solid-imager/ui/screens/manager/types"]
  N28["npm:@solid-imager/ui/screens/manager-screen"]
  N29["npm:@solid-imager/ui/toast"]
  N30["npm:~/hooks/use-batch-job-events"]
  N31["apps/server/src/components/pages/media-detail-page.tsx"]
  N32["npm:@solid-imager/ui/media-detail-header"]
  N33["npm:@solid-imager/ui/screens/media-detail-screen"]
  N34["npm:~/components/media/media-actions"]
  N35["npm:~/components/media/media-sidebar"]
  N36["npm:~/components/media/media-viewer"]
  N37["apps/server/src/components/pages/search-content.tsx"]
  N38["npm:@solid-imager/core/domain/media/schemas"]
  N39["npm:@solid-imager/core/utils"]
  N40["npm:@solid-imager/ui/button"]
  N41["apps/server/src/components/imports/pending-downloads-indicator.tsx"]
  N42["npm:@solid-imager/ui/pending-downloads-indicator"]
  N43["apps/server/src/components/imports/pending-downloads-indicator-data.ts"]
  N44["npm:@solid-imager/ui/event-stream"]
  N45["apps/server/src/components/media/ai-tagging-modal.tsx"]
  N46["npm:@solid-imager/ui/ai-tagging-modal"]
  N47["npm:~/infrastructure/api-clients/ai-api"]
  N48["apps/server/src/components/media/bulk-action-dialog.tsx"]
  N49["npm:@solid-imager/ui/bulk-action-dialog"]
  N50["apps/server/src/components/media/character-crop-modal.tsx"]
  N51["npm:@solid-imager/ui/character-crop-modal"]
  N52["apps/server/src/components/media/search-filters.tsx"]
  N53["npm:@solid-imager/core/domain/authors/schemas"]
  N54["npm:@solid-imager/core/domain/characters/schemas"]
  N55["npm:@solid-imager/core/domain/ips/schemas"]
  N56["npm:@solid-imager/core/domain/projects/schemas"]
  N57["npm:@solid-imager/core/domain/tags/schemas"]
  N58["npm:@solid-imager/ui/badge"]
  N59["apps/server/src/components/media/media-actions.tsx"]
  N60["npm:@solid-imager/ui/media-actions"]
  N61["npm:@solid-imager/ui/stores/search-store"]
  N62["npm:~/components/media/ai-tagging-modal"]
  N63["npm:~/components/media/character-crop-modal"]
  N64["npm:~/components/media/oppai-oracle-modal"]
  N65["apps/server/src/components/media/media-grid-item.tsx"]
  N66["apps/server/src/components/media/media-viewer.tsx"]
  N67["apps/server/src/components/media/move-copy-media-dialog.tsx"]
  N68["npm:@solid-imager/ui/move-copy-media-dialog"]
  N69["npm:~/infrastructure/api-clients/sources-api"]
  N70["apps/server/src/components/media/preset-manager.tsx"]
  N71["npm:@solid-imager/ui/preset-client"]
  N72["npm:@solid-imager/ui/preset-manager"]
  N73["npm:~/infrastructure/api/clients/preset-client"]
  N74["apps/server/src/components/media/pro-search-builder.tsx"]
  N75["apps/server/src/components/media/pro-search-dialog.tsx"]
  N76["apps/server/src/components/media/search-control-panel.tsx"]
  N77["npm:@solid-imager/ui/label"]
  N78["apps/server/src/components/media/media-sidebar.tsx"]
  N79["npm:@solid-imager/ui/media-sidebar-content"]
  N80["apps/server/src/components/media/sort-controls.tsx"]
  N81["apps/server/src/components/media/thumbnail-image.tsx"]
  N82["npm:@solid-imager/ui/thumbnail-image"]
  N83["apps/server/src/components/media/oppai-oracle-modal.tsx"]
  N84["npm:@solid-imager/ui/oppai-oracle-modal"]
  N85["apps/server/src/components/simple-modal.tsx"]
  N86["apps/server/src/components/api-activity-indicator.tsx"]
  N87["apps/server/src/components/not-found.tsx"]
  N88["npm:@solid-imager/ui/workspace/icons"]
  N89["apps/server/src/components/swagger-ui.tsx"]
  N90["node_modules/swagger-ui-dist/swagger-ui-bundle.js"]
  N91["node_modules/swagger-ui-dist/swagger-ui.css"]
  N92["apps/server/src/components/upload-media-modal.tsx"]
  N93["npm:@solid-imager/ui/upload-media-modal-content"]
  N94["npm:~/infrastructure/api-clients/fetch-url-api"]
  N95["apps/server/src/components/route-compat.tsx"]
  N96["npm:@solid-imager/ui/route-compat"]
  N97["npm:~/components/not-found"]
  N98["apps/server/src/config/database.ts"]
  N99["npm:node:fs"]
  N100["npm:node:path"]
  N101["node_modules/zod/index.d.cts"]
  N102["apps/server/src/router.tsx"]
  N103["apps/server/node_modules/@solid-imager/client/src/index.ts"]
  N104["apps/server/src/routeTree.gen.ts"]
  N105["apps/server/src/routes/__root.tsx"]
  N106["apps/server/src/routes/index.tsx"]
  N107["apps/server/src/routes/$.tsx"]
  N108["apps/server/src/routes/about.tsx"]
  N109["apps/server/src/routes/config.tsx"]
  N110["apps/server/src/routes/design-lab.tsx"]
  N111["apps/server/src/routes/jobs.tsx"]
  N112["apps/server/src/routes/manager.tsx"]
  N113["apps/server/src/routes/search.tsx"]
  N114["apps/server/src/routes/api/health.ts"]
  N115["apps/server/src/routes/sources/index.tsx"]
  N116["apps/server/src/routes/api/rpc.$.ts"]
  N117["apps/server/src/routes/docs/swagger/index.tsx"]
  N118["apps/server/src/routes/sources/$mediaSourceId/index.tsx"]
  N119["apps/server/src/routes/api/jobs.$jobId.artifact.ts"]
  N120["apps/server/src/routes/api/sources.$mediaSourceId.$mediaId.ts"]
  N121["apps/server/src/routes/sources/$mediaSourceId/$mediaId/index.tsx"]
  N122["apps/server/src/routes/api/sources.$mediaSourceId.thumbnail.$mediaId.ts"]
  N0 --> N1
  N2 --> N3
  N2 --> N4
  N2 --> N5
  N2 --> N6
  N2 --> N7
  N2 --> N8
  N2 --> N9
  N2 --> N10
  N2 --> N11
  N12 --> N13
  N12 --> N7
  N12 --> N14
  N12 --> N2
  N15 --> N16
  N17 --> N18
  N17 --> N19
  N17 --> N20
  N17 --> N6
  N17 --> N21
  N17 --> N11
  N22 --> N23
  N22 --> N24
  N25 --> N26
  N25 --> N18
  N25 --> N27
  N25 --> N28
  N25 --> N29
  N25 --> N6
  N25 --> N30
  N31 --> N32
  N31 --> N33
  N31 --> N6
  N31 --> N8
  N31 --> N34
  N31 --> N35
  N31 --> N36
  N31 --> N10
  N37 --> N38
  N37 --> N39
  N37 --> N40
  N41 --> N42
  N41 --> N43
  N43 --> N44
  N45 --> N46
  N45 --> N47
  N48 --> N49
  N50 --> N38
  N50 --> N51
  N50 --> N47
  N52 --> N53
  N52 --> N54
  N52 --> N55
  N52 --> N38
  N52 --> N56
  N52 --> N57
  N52 --> N58
  N52 --> N40
  N59 --> N38
  N59 --> N60
  N59 --> N61
  N59 --> N7
  N59 --> N62
  N59 --> N63
  N59 --> N64
  N59 --> N30
  N65 --> N38
  N66 --> N38
  N67 --> N3
  N67 --> N68
  N67 --> N8
  N67 --> N69
  N70 --> N71
  N70 --> N72
  N70 --> N73
  N74 --> N53
  N74 --> N54
  N74 --> N55
  N75 --> N53
  N75 --> N54
  N75 --> N55
  N75 --> N38
  N75 --> N56
  N75 --> N57
  N75 --> N40
  N76 --> N53
  N76 --> N54
  N76 --> N55
  N76 --> N56
  N76 --> N3
  N76 --> N57
  N76 --> N40
  N76 --> N77
  N78 --> N38
  N78 --> N79
  N78 --> N8
  N80 --> N77
  N81 --> N38
  N81 --> N82
  N83 --> N84
  N83 --> N47
  N85 --> N40
  N85 --> N8
  N86 --> N6
  N87 --> N40
  N87 --> N88
  N87 --> N7
  N89 --> N8
  N89 --> N90
  N89 --> N91
  N92 --> N93
  N92 --> N94
  N95 --> N96
  N95 --> N7
  N95 --> N8
  N95 --> N97
  N98 --> N99
  N98 --> N100
  N98 --> N101
  N102 --> N103
  N102 --> N18
  N104 --> N105
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
```
