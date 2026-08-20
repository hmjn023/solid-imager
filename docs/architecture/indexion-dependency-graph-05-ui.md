# solid-imager detail 05 - ui

```mermaid
graph LR
  N0[ai-tagging-modal.tsx]
  N1[npm:@solid-imager/core/domain/tagging/schemas]
  N2[packages/ui/node_modules/solid-js/types/index.d.ts]
  N3[badge.tsx]
  N4[association-manager.tsx]
  N5[npm:@solid-imager/core/utils]
  N6[button.tsx]
  N7[packages/ui/node_modules/class-variance-authority/dist/index.d.ts]
  N8[utils/cn.ts]
  N9[card.tsx]
  N10[character-crop-modal.tsx]
  N11[npm:@solid-imager/core/domain/media/schemas]
  N12[checkbox.tsx]
  N13[clipboard-copy.tsx]
  N14[toast.tsx]
  N15[collapsible.tsx]
  N16[packages/ui/node_modules/@kobalte/core/dist/index.d.ts]
  N17[combobox.tsx]
  N18[npm:@kobalte/core/combobox]
  N19[npm:@kobalte/core/polymorphic]
  N20[packages/ui/node_modules/@tanstack/solid-virtual/dist/cjs/index.cjs]
  N21[command.tsx]
  N22[npm:@kobalte/core/dialog]
  N23[packages/ui/node_modules/cmdk-solid/dist/index.cjs]
  N24[counter.tsx]
  N25[dummy.test.ts]
  N26[packages/ui/node_modules/vitest/dist/index.js]
  N27[hooks/use-manager-page.ts]
  N28[npm:@solid-imager/core/domain/characters/schemas]
  N29[npm:@solid-imager/core/domain/ips/schemas]
  N30[npm:@solid-imager/core/domain/projects/schemas]
  N31[hooks/use-search-page.ts]
  N32[hooks/use-source-media-page.test.ts]
  N33[hooks/restore-import.ts]
  N34[hooks/use-source-media-page.ts]
  N35[npm:@solid-imager/core/domain/jobs/schemas]
  N36[hooks/use-source-root-path.test.ts]
  N37[hooks/use-source-root-path.ts]
  N38[npm:@solid-imager/core/domain/sources/schemas]
  N39[packages/ui/node_modules/@tanstack/solid-query/build/index.cjs]
  N40[hooks/use-batch-job-events.test.ts]
  N41[npm:@solid-imager/core/domain/sources/events]
  N42[hooks/use-current-search-persistence.test.ts]
  N43[hooks/scroll-container.ts]
  N44[packages/ui/node_modules/solid-js/web/types/index.d.ts]
  N45[hooks/use-job-events.ts]
  N46[event-stream.ts]
  N47[import-inbox-helpers.ts]
  N48[input.tsx]
  N49[label.tsx]
  N50[layouts/app-shell.tsx]
  N51[media-card-item.tsx]
  N52[media-grid-item.tsx]
  N53[media-list-actions.tsx]
  N54[packages/ui/node_modules/@tanstack/solid-router/dist/cjs/index.cjs]
  N55[media-sidebar-content.tsx]
  N56[media-sidebar.tsx]
  N57[move-copy-media-dialog.tsx]
  N58[pagination-controls.tsx]
  N59[pending-downloads-indicator.tsx]
  N60[import-review-modal.tsx]
  N61[pending-downloads-indicator.types.ts]
  N62[pending-downloads-indicator-core.tsx]
  N63[popover.tsx]
  N64[npm:@kobalte/core/popover]
  N65[preset-client.ts]
  N66[npm:@solid-imager/core/domain/contract/presets-client]
  N67[pro-search-builder.tsx]
  N68[npm:@solid-imager/core/domain/authors/schemas]
  N69[pro-search-dialog.tsx]
  N70[npm:@solid-imager/core/domain/tags/schemas]
  N71[query-options/authors-query.ts]
  N72[query-options/characters-query.ts]
  N73[query-options/config-query.ts]
  N74[npm:@solid-imager/core/domain/config/config-schema]
  N75[query-options/ips-query.ts]
  N76[query-options/media-query.ts]
  N77[npm:@solid-imager/core/domain/shared/schemas]
  N78[query-options/projects-query.ts]
  N79[query-options/sources-query.ts]
  N80[query-options/tags-query.ts]
  N81[query-options/prefetch.ts]
  N82[query-options/query-client.test.ts]
  N83[query-options/query-client.ts]
  N84[screens/config-screen.tsx]
  N85[packages/ui/node_modules/@tanstack/solid-form/dist/cjs/index.cjs]
  N86[packages/ui/node_modules/zod/index.d.cts]
  N87[screens/manager-screen.tsx]
  N88[screens/not-found-screen.tsx]
  N89[screens/search-screen.tsx]
  N90[async-state.tsx]
  N91[mobile-search-filter-dialog.tsx]
  N92[search-control-panel.tsx]
  N93[skeleton.tsx]
  N94[source-media-grid.tsx]
  N95[screens/search-screen.types.ts]
  N96[screens/source-media-screen.tsx]
  N97[screens/config-state-screen.types.ts]
  N98[query-state.ts]
  N99[screens/design-concept-screen.tsx]
  N100[npm:lucide-solid/icons/arrow-down-up]
  N101[npm:lucide-solid/icons/arrow-left]
  N102[npm:lucide-solid/icons/ban]
  N103[npm:lucide-solid/icons/bot]
  N104[npm:lucide-solid/icons/briefcase-business]
  N105[npm:lucide-solid/icons/chevron-down]
  N106[npm:lucide-solid/icons/chevron-left]
  N107[npm:lucide-solid/icons/chevron-right]
  N108[npm:lucide-solid/icons/circle-alert]
  N109[npm:lucide-solid/icons/circle-check]
  N110[npm:lucide-solid/icons/clock-3]
  N111[npm:lucide-solid/icons/cloud-download]
  N112[npm:lucide-solid/icons/database]
  N113[npm:lucide-solid/icons/download]
  N114[npm:lucide-solid/icons/external-link]
  N115[npm:lucide-solid/icons/filter]
  N116[npm:lucide-solid/icons/folder]
  N117[npm:lucide-solid/icons/grid-3-x-3]
  N118[npm:lucide-solid/icons/hard-drive]
  N119[npm:lucide-solid/icons/image]
  N120[npm:lucide-solid/icons/inbox]
  N121[npm:lucide-solid/icons/library]
  N122[npm:lucide-solid/icons/list]
  N123[npm:lucide-solid/icons/logs]
  N124[npm:lucide-solid/icons/panel-left-close]
  N125[npm:lucide-solid/icons/panel-left-open]
  N126[npm:lucide-solid/icons/panels-top-left]
  N127[npm:lucide-solid/icons/plus]
  N128[npm:lucide-solid/icons/refresh-cw]
  N129[npm:lucide-solid/icons/rotate-ccw]
  N130[npm:lucide-solid/icons/search]
  N131[npm:lucide-solid/icons/settings]
  N132[npm:lucide-solid/icons/share-2]
  N133[npm:lucide-solid/icons/trash-2]
  N134[npm:lucide-solid/icons/x]
  N135[screens/legacy-config-state-screen.tsx]
  N136[screens/legacy-media-detail-screen.tsx]
  N137[legacy-media-detail-skeleton.tsx]
  N138[screens/media-detail-screen.types.ts]
  N139[screens/media-detail-screen-core.tsx]
  N140[screens/source-media-screen.types.ts]
  N141[screens/v2-config-screen.tsx]
  N142[screens/v2-config-state-screen.tsx]
  N143[v2/management-layout.tsx]
  N144[screens/v2-manager-screen.tsx]
  N145[screens/v2-manager/batch-tools.tsx]
  N146[screens/v2-manager/job-status.tsx]
  N147[screens/v2-manager/source-select.tsx]
  N148[screens/v2-manager/data-transfer.tsx]
  N149[npm:lucide-solid/icons/upload]
  N150[screens/v2-manager/dialogs.tsx]
  N151[screens/v2-manager/duplicates.tsx]
  N152[screens/v2-manager/entity-panel.tsx]
  N153[npm:lucide-solid/icons/pencil]
  N154[progress.tsx]
  N155[screens/v2-manager/navigation.tsx]
  N156[npm:lucide-solid/icons/copy-check]
  N157[screens/v2-manager/thumbnail.tsx]
  N158[screens/v2-manager/types.ts]
  N159[screens/v2-manager/utils.test.ts]
  N160[screens/v2-manager/utils.ts]
  N161[screens/v2-media-detail-screen.tsx]
  N162[v2-media-detail-skeleton.tsx]
  N163[screens/v2-search-screen.tsx]
  N164[screens/v2-source-media-screen.tsx]
  N165[npm:@solid-imager/core/domain/search/logic]
  N166[npm:@solid-imager/core/domain/search/schema]
  N167[packages/ui/node_modules/solid-js/store/types/index.d.ts]
  N168[preset-manager.tsx]
  N169[search-filters.tsx]
  N170[select.tsx]
  N171[sort-controls.tsx]
  N172[source-delete-modal.tsx]
  N173[source-media-page.tsx]
  N174[stores/search-store.ts]
  N175[stores/search-store.test.ts]
  N176[switch.tsx]
  N177[tabs.tsx]
  N178[textarea.tsx]
  N179[thumbnail-image.tsx]
  N180[thumbnail-source.ts]
  N181[packages/ui/node_modules/clsx/dist/clsx.js]
  N182[packages/ui/node_modules/tailwind-merge/dist/types.d.ts]
  N183[utils/debounce.ts]
  N184[event-stream.test.ts]
  N185[form-message.tsx]
  N186[form-schemas.test.ts]
  N187[form-schemas.ts]
  N188[oppai-oracle-modal.tsx]
  N189[query-state.test.ts]
  N190[router-status.tsx]
  N191[screen-skeleton.tsx]
  N192[text-field.tsx]
  N193[npm:@kobalte/core/text-field]
  N194[import-review-modal.types.ts]
  N195[legacy-import-review-modal.tsx]
  N196[legacy-upload-media-modal.tsx]
  N197[media-preview-selection.test.ts]
  N198[media-preview-selection.ts]
  N199[v2/collection-inspector.tsx]
  N200[v2/icons.tsx]
  N201[v2/search-composer-utils.ts]
  N202[v2/search-composer.test.ts]
  N203[v2/search-composer.tsx]
  N204[v2/search-toolbar.tsx]
  N205[thumbnail-source.test.ts]
  N206[v2-import-review-modal.tsx]
  N207[v2-media-grid-item.tsx]
  N208[v2-pending-downloads-indicator.tsx]
  N209[v2-upload-media-modal-content.tsx]
  N210[upload-media-modal-content.types.ts]
  N211[v2-upload-media-modal.tsx]
  N212[search-history-client.ts]
  N213[npm:@solid-imager/core/domain/contract/search-snapshots-client]
  N214[search-history-route.ts]
  N0 --> N1
  N0 --> N2
  N0 --> N3
  N4 --> N5
  N4 --> N2
  N4 --> N3
  N4 --> N6
  N3 --> N7
  N3 --> N2
  N3 --> N8
  N9 --> N2
  N9 --> N8
  N10 --> N11
  N10 --> N1
  N10 --> N2
  N10 --> N12
  N13 --> N2
  N13 --> N14
  N13 --> N8
  N15 --> N16
  N17 --> N18
  N17 --> N19
  N17 --> N20
  N17 --> N2
  N21 --> N22
  N21 --> N23
  N24 --> N2
  N25 --> N26
  N27 --> N28
  N27 --> N29
  N27 --> N11
  N27 --> N30
  N31 --> N28
  N31 --> N29
  N32 --> N26
  N32 --> N33
  N34 --> N28
  N34 --> N29
  N34 --> N35
  N36 --> N26
  N36 --> N37
  N37 --> N38
  N37 --> N39
  N40 --> N41
  N40 --> N26
  N42 --> N2
  N42 --> N26
  N43 --> N2
  N43 --> N44
  N45 --> N41
  N45 --> N2
  N45 --> N44
  N45 --> N46
  N47 --> N11
  N47 --> N38
  N48 --> N2
  N48 --> N8
  N49 --> N2
  N49 --> N8
  N50 --> N2
  N51 --> N11
  N51 --> N2
  N51 --> N9
  N51 --> N12
  N51 --> N8
  N52 --> N11
  N52 --> N2
  N52 --> N8
  N53 --> N54
  N53 --> N2
  N53 --> N44
  N53 --> N6
  N55 --> N28
  N55 --> N29
  N55 --> N11
  N55 --> N30
  N56 --> N28
  N56 --> N29
  N56 --> N11
  N56 --> N30
  N57 --> N2
  N57 --> N6
  N58 --> N6
  N59 --> N2
  N59 --> N60
  N59 --> N61
  N59 --> N62
  N63 --> N19
  N63 --> N64
  N63 --> N2
  N63 --> N8
  N65 --> N66
  N65 --> N11
  N67 --> N68
  N67 --> N28
  N67 --> N29
  N69 --> N68
  N69 --> N28
  N69 --> N29
  N69 --> N11
  N69 --> N30
  N69 --> N70
  N69 --> N2
  N69 --> N6
  N71 --> N68
  N71 --> N39
  N72 --> N28
  N72 --> N39
  N73 --> N74
  N73 --> N39
  N75 --> N29
  N75 --> N39
  N76 --> N11
  N76 --> N77
  N76 --> N39
  N78 --> N30
  N78 --> N39
  N79 --> N38
  N79 --> N39
  N80 --> N70
  N80 --> N39
  N81 --> N44
  N82 --> N39
  N82 --> N26
  N83 --> N39
  N84 --> N74
  N84 --> N85
  N84 --> N2
  N84 --> N86
  N84 --> N6
  N87 --> N29
  N87 --> N11
  N87 --> N2
  N88 --> N54
  N89 --> N54
  N89 --> N2
  N89 --> N90
  N89 --> N9
  N89 --> N91
  N89 --> N92
  N89 --> N93
  N89 --> N94
  N89 --> N95
  N96 --> N54
  N96 --> N2
  N96 --> N90
  N96 --> N6
  N96 --> N9
  N97 --> N74
  N97 --> N98
  N99 --> N100
  N99 --> N101
  N99 --> N102
  N99 --> N103
  N99 --> N104
  N99 --> N105
  N99 --> N106
  N99 --> N107
  N99 --> N108
  N99 --> N109
  N99 --> N110
  N99 --> N111
  N99 --> N112
  N99 --> N113
  N99 --> N114
  N99 --> N115
  N99 --> N116
  N99 --> N117
  N99 --> N118
  N99 --> N119
  N99 --> N120
  N99 --> N121
  N99 --> N122
  N99 --> N123
  N99 --> N124
  N99 --> N125
  N99 --> N126
  N99 --> N127
  N99 --> N128
  N99 --> N129
  N99 --> N130
  N99 --> N131
  N99 --> N132
  N99 --> N133
  N99 --> N134
  N135 --> N2
  N135 --> N90
  N135 --> N93
  N135 --> N8
  N135 --> N84
  N135 --> N97
  N136 --> N137
  N136 --> N93
  N136 --> N138
  N136 --> N139
  N139 --> N11
  N138 --> N11
  N95 --> N11
  N95 --> N38
  N140 --> N11
  N140 --> N2
  N141 --> N74
  N141 --> N1
  N141 --> N85
  N141 --> N54
  N141 --> N103
  N141 --> N104
  N141 --> N111
  N141 --> N118
  N141 --> N119
  N141 --> N123
  N141 --> N2
  N141 --> N86
  N142 --> N1
  N142 --> N2
  N142 --> N90
  N142 --> N93
  N142 --> N8
  N142 --> N143
  N142 --> N97
  N142 --> N141
  N144 --> N2
  N145 --> N2
  N145 --> N6
  N145 --> N12
  N145 --> N27
  N145 --> N49
  N145 --> N146
  N145 --> N147
  N148 --> N113
  N148 --> N149
  N148 --> N2
  N148 --> N6
  N148 --> N12
  N148 --> N27
  N148 --> N48
  N148 --> N49
  N150 --> N29
  N150 --> N2
  N151 --> N2
  N151 --> N6
  N151 --> N27
  N151 --> N49
  N152 --> N153
  N152 --> N127
  N152 --> N130
  N152 --> N133
  N152 --> N2
  N152 --> N90
  N152 --> N6
  N146 --> N2
  N146 --> N3
  N146 --> N27
  N146 --> N154
  N155 --> N103
  N155 --> N156
  N155 --> N116
  N155 --> N119
  N155 --> N132
  N155 --> N2
  N155 --> N6
  N147 --> N27
  N157 --> N2
  N157 --> N6
  N157 --> N27
  N157 --> N49
  N157 --> N146
  N157 --> N147
  N158 --> N27
  N159 --> N26
  N159 --> N160
  N160 --> N28
  N160 --> N29
  N161 --> N93
  N161 --> N162
  N161 --> N138
  N161 --> N139
  N163 --> N11
  N163 --> N2
  N163 --> N90
  N163 --> N93
  N164 --> N149
  N164 --> N2
  N164 --> N90
  N164 --> N6
  N92 --> N68
  N92 --> N28
  N92 --> N29
  N92 --> N30
  N92 --> N165
  N92 --> N166
  N92 --> N38
  N92 --> N70
  N92 --> N2
  N92 --> N167
  N92 --> N6
  N92 --> N49
  N92 --> N168
  N92 --> N69
  N92 --> N169
  N169 --> N68
  N169 --> N28
  N169 --> N29
  N169 --> N30
  N169 --> N166
  N169 --> N70
  N169 --> N2
  N169 --> N167
  N169 --> N3
  N169 --> N6
  N170 --> N19
  N171 --> N49
  N172 --> N6
  N94 --> N11
  N173 --> N28
  N173 --> N29
  N174 --> N11
  N175 --> N26
  N176 --> N16
  N177 --> N16
  N178 --> N2
  N178 --> N8
  N179 --> N2
  N180 --> N11
  N180 --> N2
  N180 --> N179
  N14 --> N2
  N14 --> N44
  N8 --> N181
  N8 --> N182
  N183 --> N2
  N90 --> N2
  N90 --> N44
  N90 --> N6
  N90 --> N98
  N90 --> N8
  N184 --> N26
  N184 --> N46
  N185 --> N2
  N185 --> N8
  N186 --> N26
  N187 --> N86
  N188 --> N1
  N188 --> N2
  N188 --> N3
  N189 --> N26
  N189 --> N98
  N190 --> N54
  N190 --> N2
  N190 --> N90
  N190 --> N191
  N191 --> N2
  N191 --> N137
  N93 --> N2
  N93 --> N9
  N93 --> N8
  N192 --> N16
  N192 --> N193
  N192 --> N7
  N192 --> N2
  N192 --> N8
  N194 --> N11
  N194 --> N38
  N195 --> N5
  N137 --> N93
  N137 --> N8
  N196 --> N5
  N196 --> N85
  N196 --> N2
  N196 --> N86
  N196 --> N6
  N197 --> N26
  N197 --> N198
  N199 --> N11
  N199 --> N2
  N199 --> N6
  N200 --> N2
  N143 --> N2
  N201 --> N31
  N202 --> N26
  N202 --> N31
  N203 --> N130
  N203 --> N2
  N204 --> N166
  N204 --> N38
  N204 --> N100
  N204 --> N105
  N204 --> N115
  N204 --> N117
  N204 --> N122
  N204 --> N2
  N62 --> N5
  N61 --> N41
  N61 --> N38
  N61 --> N194
  N205 --> N2
  N205 --> N26
  N206 --> N5
  N162 --> N93
  N162 --> N8
  N207 --> N11
  N207 --> N2
  N207 --> N8
  N208 --> N2
  N208 --> N61
  N208 --> N62
  N208 --> N8
  N208 --> N206
  N209 --> N210
  N211 --> N5
  N211 --> N85
  N211 --> N2
  N211 --> N86
  N212 --> N213
  N214 --> N86
```
