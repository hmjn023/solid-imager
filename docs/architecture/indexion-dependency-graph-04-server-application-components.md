# solid-imager detail 04 - server components and root modules

```mermaid
graph LR
  N0[components/imports/pending-downloads-indicator.tsx]
  N1[npm:@solid-imager/ui/pending-downloads-indicator]
  N2[components/imports/pending-downloads-indicator-data.ts]
  N3[npm:@solid-imager/ui/event-stream]
  N4[components/imports/v2-pending-downloads-indicator.tsx]
  N5[npm:@solid-imager/ui/v2-pending-downloads-indicator]
  N6[components/media/ai-tagging-modal.tsx]
  N7[npm:@solid-imager/ui/ai-tagging-modal]
  N8[npm:~/infrastructure/api-clients/ai-api]
  N9[components/media/association-manager.tsx]
  N10[npm:@solid-imager/ui/badge]
  N11[npm:@solid-imager/ui/button]
  N12[components/media/bulk-action-dialog.tsx]
  N13[npm:@solid-imager/core/domain/sources/schemas]
  N14[components/media/character-crop-modal.tsx]
  N15[npm:@solid-imager/core/domain/media/schemas]
  N16[npm:@solid-imager/ui/character-crop-modal]
  N17[components/media/search-filters.tsx]
  N18[npm:@solid-imager/core/domain/authors/schemas]
  N19[npm:@solid-imager/core/domain/characters/schemas]
  N20[npm:@solid-imager/core/domain/ips/schemas]
  N21[npm:@solid-imager/core/domain/projects/schemas]
  N22[npm:@solid-imager/core/domain/tags/schemas]
  N23[components/media/media-viewer.tsx]
  N24[components/media/move-copy-media-dialog.tsx]
  N25[npm:@solid-imager/ui/move-copy-media-dialog]
  N26[apps/server/node_modules/solid-js/types/index.d.ts]
  N27[npm:~/infrastructure/api-clients/sources-api]
  N28[components/media/preset-manager.tsx]
  N29[npm:@solid-imager/ui/preset-client]
  N30[npm:@solid-imager/ui/preset-manager]
  N31[npm:~/infrastructure/api/clients/preset-client]
  N32[components/media/pro-search-builder.tsx]
  N33[components/media/pro-search-dialog.tsx]
  N34[components/media/search-control-panel.tsx]
  N35[npm:@solid-imager/ui/label]
  N36[components/media/sort-controls.tsx]
  N37[components/media/thumbnail-image.tsx]
  N38[npm:@solid-imager/ui/thumbnail-image]
  N39[components/media/oppai-oracle-modal.tsx]
  N40[npm:@solid-imager/ui/oppai-oracle-modal]
  N41[components/media/legacy-media-grid-item.tsx]
  N42[components/media/legacy-media-sidebar.tsx]
  N43[npm:@solid-imager/core/utils]
  N44[npm:@solid-imager/ui/clipboard-copy]
  N45[npm:@solid-imager/ui/collapsible]
  N46[npm:@solid-imager/ui/stores/search-store]
  N47[npm:@solid-imager/ui/toast]
  N48[apps/server/node_modules/@tanstack/solid-query/build/index.cjs]
  N49[apps/server/node_modules/@tanstack/solid-router/dist/cjs/index.cjs]
  N50[components/media/v2-media-actions.tsx]
  N51[components/media/v2-media-sidebar.tsx]
  N52[components/media/v2-media-viewer.tsx]
  N53[components/nav.tsx]
  N54[npm:@solid-imager/ui/layouts/app-nav]
  N55[components/simple-modal.tsx]
  N56[components/swagger-ui.tsx]
  N57[apps/server/node_modules/swagger-ui-dist/swagger-ui-bundle.js]
  N58[apps/server/node_modules/swagger-ui-dist/swagger-ui.css]
  N59[components/upload-media-modal.tsx]
  N60[npm:@solid-imager/ui/legacy-upload-media-modal-content]
  N61[npm:~/infrastructure/api-clients/fetch-url-api]
  N62[components/api-activity-indicator.tsx]
  N63[components/v2-upload-media-modal.tsx]
  N64[npm:@solid-imager/ui/v2-upload-media-modal-content]
  N65[components/v2/v2-mobile-header.tsx]
  N66[npm:@solid-imager/ui/v2/icons]
  N67[npm:~/components/imports/v2-pending-downloads-indicator]
  N68[components/v2/v2-sidebar.tsx]
  N69[components/v2/v2-source-list.tsx]
  N70[config/database.ts]
  N71[npm:node:fs]
  N72[npm:node:path]
  N73[apps/server/node_modules/zod/index.d.cts]
  N74[routeTree.gen.ts]
  N75[apps/server/src/routes/__root.tsx]
  N76[apps/server/src/routes/search.tsx]
  N77[apps/server/src/routes/manager.tsx]
  N78[apps/server/src/routes/design-lab.tsx]
  N79[apps/server/src/routes/config.tsx]
  N80[apps/server/src/routes/about.tsx]
  N81[apps/server/src/routes/$.tsx]
  N82[apps/server/src/routes/v2/route.tsx]
  N83[apps/server/src/routes/index.tsx]
  N84[apps/server/src/routes/v2/index.tsx]
  N85[apps/server/src/routes/sources/index.tsx]
  N86[apps/server/src/routes/v2/search.tsx]
  N87[apps/server/src/routes/v2/manager.tsx]
  N88[apps/server/src/routes/v2/jobs.tsx]
  N89[apps/server/src/routes/v2/config.tsx]
  N90[apps/server/src/routes/v2/about.tsx]
  N91[apps/server/src/routes/v2/$.tsx]
  N92[apps/server/src/routes/sources/$mediaSourceId/index.tsx]
  N93[apps/server/src/routes/docs/swagger/index.tsx]
  N94[apps/server/src/routes/api/rpc.$.ts]
  N95[apps/server/src/routes/v2/sources/$mediaSourceId/index.tsx]
  N96[apps/server/src/routes/sources/$mediaSourceId/$mediaId/index.tsx]
  N97[apps/server/src/routes/api/sources.$mediaSourceId.$mediaId.ts]
  N98[apps/server/src/routes/api/jobs.$jobId.artifact.ts]
  N99[apps/server/src/routes/v2/sources/$mediaSourceId/$mediaId/index.tsx]
  N100[apps/server/src/routes/api/sources.$mediaSourceId.thumbnail.$mediaId.ts]
  N101[app.css]
  N102[url:]
  N0 --> N1
  N0 --> N2
  N2 --> N3
  N4 --> N5
  N4 --> N2
  N6 --> N7
  N6 --> N8
  N9 --> N10
  N9 --> N11
  N12 --> N13
  N12 --> N11
  N14 --> N15
  N14 --> N16
  N14 --> N8
  N17 --> N18
  N17 --> N19
  N17 --> N20
  N17 --> N21
  N17 --> N22
  N17 --> N10
  N17 --> N11
  N23 --> N15
  N24 --> N13
  N24 --> N25
  N24 --> N26
  N24 --> N27
  N28 --> N29
  N28 --> N30
  N28 --> N31
  N32 --> N18
  N32 --> N19
  N32 --> N20
  N33 --> N18
  N33 --> N19
  N33 --> N20
  N33 --> N15
  N33 --> N21
  N33 --> N22
  N33 --> N11
  N34 --> N18
  N34 --> N19
  N34 --> N20
  N34 --> N21
  N34 --> N13
  N34 --> N22
  N34 --> N11
  N34 --> N35
  N36 --> N35
  N37 --> N15
  N37 --> N38
  N39 --> N40
  N39 --> N8
  N41 --> N15
  N42 --> N15
  N42 --> N43
  N42 --> N10
  N42 --> N44
  N42 --> N45
  N42 --> N46
  N42 --> N47
  N42 --> N48
  N42 --> N49
  N50 --> N15
  N50 --> N43
  N50 --> N11
  N51 --> N15
  N51 --> N43
  N52 --> N15
  N53 --> N54
  N53 --> N0
  N55 --> N11
  N55 --> N26
  N56 --> N26
  N56 --> N57
  N56 --> N58
  N59 --> N60
  N59 --> N61
  N62 --> N48
  N63 --> N64
  N63 --> N61
  N65 --> N11
  N65 --> N66
  N65 --> N67
  N68 --> N13
  N68 --> N11
  N69 --> N13
  N69 --> N11
  N70 --> N71
  N70 --> N72
  N70 --> N73
  N74 --> N75
  N74 --> N76
  N74 --> N77
  N74 --> N78
  N74 --> N79
  N74 --> N80
  N74 --> N81
  N74 --> N82
  N74 --> N83
  N74 --> N84
  N74 --> N85
  N74 --> N86
  N74 --> N87
  N74 --> N88
  N74 --> N89
  N74 --> N90
  N74 --> N91
  N74 --> N92
  N74 --> N93
  N74 --> N94
  N74 --> N95
  N74 --> N96
  N74 --> N97
  N74 --> N98
  N74 --> N99
  N74 --> N100
  N101 --> N102
```
