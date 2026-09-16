# solid-imager detail 05 - UI

## Diagram 1

```mermaid
graph LR
  N0["ai-tagging-modal.tsx"]
  N1["npm:@solid-imager/core/domain/tagging/schemas"]
  N2["node_modules/solid-js/types/index.d.ts"]
  N3["badge.tsx"]
  N4["association-manager.tsx"]
  N5["npm:@solid-imager/core/utils"]
  N6["button.tsx"]
  N7["node_modules/class-variance-authority/dist/index.d.ts"]
  N8["utils/cn.ts"]
  N9["card.tsx"]
  N10["character-crop-modal.tsx"]
  N11["npm:@solid-imager/core/domain/media/schemas"]
  N12["checkbox.tsx"]
  N13["clipboard-copy.tsx"]
  N14["toast.tsx"]
  N15["collapsible.tsx"]
  N16["node_modules/@kobalte/core/dist/index.d.ts"]
  N17["combobox.tsx"]
  N18["npm:@kobalte/core/combobox"]
  N19["npm:@kobalte/core/polymorphic"]
  N20["node_modules/@tanstack/solid-virtual/dist/cjs/index.cjs"]
  N21["command.tsx"]
  N22["npm:@kobalte/core/dialog"]
  N23["node_modules/cmdk-solid/dist/index.cjs"]
  N24["counter.tsx"]
  N25["dummy.test.ts"]
  N26["node_modules/vitest/dist/index.js"]
  N27["hooks/use-manager-page.ts"]
  N28["npm:@solid-imager/core/domain/characters/schemas"]
  N29["npm:@solid-imager/core/domain/ips/schemas"]
  N30["npm:@solid-imager/core/domain/projects/schemas"]
  N31["hooks/use-search-page.ts"]
  N32["hooks/use-source-media-page.test.ts"]
  N33["hooks/restore-import.ts"]
  N34["hooks/use-source-media-page.ts"]
  N35["npm:@solid-imager/core/domain/jobs/schemas"]
  N36["hooks/use-source-root-path.test.ts"]
  N37["hooks/use-source-root-path.ts"]
  N38["npm:@solid-imager/core/domain/sources/schemas"]
  N39["node_modules/@tanstack/solid-query/build/index.cjs"]
  N40["hooks/use-batch-job-events.test.ts"]
  N41["npm:@solid-imager/core/domain/sources/events"]
  N42["hooks/use-current-search-persistence.test.ts"]
  N43["hooks/scroll-container.ts"]
  N44["node_modules/solid-js/web/types/index.d.ts"]
  N45["hooks/use-job-events.ts"]
  N46["event-stream.ts"]
  N47["hooks/use-media-collection-selection.test.ts"]
  N48["hooks/use-media-collection-selection.ts"]
  N49["hooks/stable-media-results.ts"]
  N50["node_modules/solid-js/store/types/index.d.ts"]
  N51["import-inbox-helpers.ts"]
  N52["input.tsx"]
  N53["label.tsx"]
  N54["layouts/app-shell.tsx"]
  N55["layouts/command-center.tsx"]
  N56["node_modules/@tanstack/solid-router/dist/cjs/index.cjs"]
  N57["layouts/mobile-header.tsx"]
  N58["workspace/icons.tsx"]
  N59["layouts/navigation.tsx"]
  N60["layouts/sidebar.tsx"]
  N61["shortcuts/index.ts"]
  N62["layouts/source-list.tsx"]
  N63["media-card-item.tsx"]
  N64["import-review-modal.tsx"]
  N65["media-list-actions.tsx"]
  N66["tauri-media-grid-item.tsx"]
  N67["media-sidebar.tsx"]
  N68["move-copy-media-dialog.tsx"]
  N69["pagination-controls.tsx"]
  N70["upload-media-modal.tsx"]
  N71["node_modules/@tanstack/solid-form/dist/cjs/index.cjs"]
  N72["node_modules/zod/index.d.cts"]
  N73["popover.tsx"]
  N74["npm:@kobalte/core/popover"]
  N75["preset-client.ts"]
  N76["npm:@solid-imager/core/domain/contract/presets-client"]
  N77["pro-search-builder.tsx"]
  N78["npm:@solid-imager/core/domain/authors/schemas"]
  N79["pro-search-dialog.tsx"]
  N80["npm:@solid-imager/core/domain/tags/schemas"]
  N81["query-options/authors-query.ts"]
  N82["query-options/characters-query.ts"]
  N83["query-options/config-query.ts"]
  N84["npm:@solid-imager/core/domain/config/config-schema"]
  N85["query-options/ips-query.ts"]
  N86["query-options/media-query.ts"]
  N87["npm:@solid-imager/core/domain/shared/schemas"]
  N88["query-options/projects-query.ts"]
  N89["query-options/sources-query.ts"]
  N90["query-options/tags-query.ts"]
  N91["query-options/prefetch.ts"]
  N92["query-options/query-client.test.ts"]
  N93["query-options/query-client.ts"]
  N94["query-options/jobs-query.test.ts"]
  N95["query-options/jobs-query.ts"]
  N96["screens/config-screen.tsx"]
  N97["npm:lucide-solid/icons/bot"]
  N98["npm:lucide-solid/icons/briefcase-business"]
  N99["npm:lucide-solid/icons/cloud-download"]
  N100["npm:lucide-solid/icons/hard-drive"]
  N101["npm:lucide-solid/icons/image"]
  N102["npm:lucide-solid/icons/keyboard"]
  N103["npm:lucide-solid/icons/logs"]
  N104["screens/config-state-screen.tsx"]
  N105["async-state.tsx"]
  N106["skeleton.tsx"]
  N107["workspace/management-layout.tsx"]
  N108["screens/config-state-screen.types.ts"]
  N109["screens/media-detail-screen.tsx"]
  N110["media-detail-skeleton.tsx"]
  N111["screens/media-detail-screen.types.ts"]
  N112["screens/media-detail-screen-core.tsx"]
  N113["screens/not-found-screen.tsx"]
  N114["screens/manager-screen.tsx"]
  N115["screens/search-screen.tsx"]
  N116["screens/source-media-screen.tsx"]
  N117["npm:lucide-solid/icons/upload"]
  N118["query-state.ts"]
  N119["screens/design-concept-screen.tsx"]
  N120["npm:lucide-solid/icons/arrow-down-up"]
  N121["npm:lucide-solid/icons/arrow-left"]
  N122["npm:lucide-solid/icons/ban"]
  N123["npm:lucide-solid/icons/chevron-down"]
  N124["npm:lucide-solid/icons/chevron-left"]
  N125["npm:lucide-solid/icons/chevron-right"]
  N126["npm:lucide-solid/icons/circle-alert"]
  N127["npm:lucide-solid/icons/circle-check"]
  N128["npm:lucide-solid/icons/clock-3"]
  N129["npm:lucide-solid/icons/database"]
  N130["npm:lucide-solid/icons/download"]
  N131["npm:lucide-solid/icons/external-link"]
  N132["npm:lucide-solid/icons/filter"]
  N133["npm:lucide-solid/icons/folder"]
  N134["npm:lucide-solid/icons/grid-3-x-3"]
  N135["npm:lucide-solid/icons/inbox"]
  N136["npm:lucide-solid/icons/library"]
  N137["npm:lucide-solid/icons/list"]
  N138["npm:lucide-solid/icons/panel-left-close"]
  N139["npm:lucide-solid/icons/panel-left-open"]
  N140["npm:lucide-solid/icons/panels-top-left"]
  N141["npm:lucide-solid/icons/plus"]
  N142["npm:lucide-solid/icons/refresh-cw"]
  N143["npm:lucide-solid/icons/rotate-ccw"]
  N144["npm:lucide-solid/icons/search"]
  N145["npm:lucide-solid/icons/settings"]
  N146["npm:lucide-solid/icons/share-2"]
  N147["npm:lucide-solid/icons/trash-2"]
  N148["npm:lucide-solid/icons/x"]
  N149["screens/tauri-manager-screen.tsx"]
  N150["screens/search-screen.types.ts"]
  N151["screens/source-media-screen.types.ts"]
  N152["screens/jobs-selection.test.ts"]
  N153["screens/jobs-selection.ts"]
  N154["screens/tauri-search-screen.tsx"]
  N155["mobile-search-filter-dialog.tsx"]
  N156["search-control-panel.tsx"]
  N157["source-media-grid.tsx"]
  N158["screens/tauri-source-media-screen.tsx"]
  N159["screens/tauri-media-detail-screen.tsx"]
  N160["media-detail-layout-skeleton.tsx"]
  N161["screens/manager/batch-tools.tsx"]
  N162["screens/manager/job-status.tsx"]
  N163["screens/manager/source-select.tsx"]
  N164["screens/manager/data-transfer.tsx"]
  N165["screens/manager/dialogs.tsx"]
  N166["screens/manager/duplicates.tsx"]
  N167["screens/manager/entity-panel.tsx"]
  N168["npm:lucide-solid/icons/pencil"]
  N169["progress.tsx"]
  N170["screens/manager/navigation.tsx"]
  N171["npm:lucide-solid/icons/copy-check"]
  N172["screens/manager/thumbnail.tsx"]
  N173["screens/manager/types.ts"]
  N174["screens/manager/utils.test.ts"]
  N175["screens/manager/utils.ts"]
  N176["screens/tauri-config-screen.tsx"]
  N177["screens/tauri-config-state-screen.tsx"]
  N178["npm:@solid-imager/core/domain/search/logic"]
  N179["npm:@solid-imager/core/domain/search/schema"]
  N180["preset-manager.tsx"]
  N181["search-filters.tsx"]
  N182["select.tsx"]
  N183["sort-controls.tsx"]
  N184["source-delete-modal.tsx"]
  N185["media-grid-item.tsx"]
  N186["source-media-page.tsx"]
  N187["stores/search-store.ts"]
  N188["stores/search-store.test.ts"]
  N189["switch.tsx"]
  N190["tabs.tsx"]
  N191["textarea.tsx"]
  N192["thumbnail-image.tsx"]
  N193["thumbnail-source.ts"]
  N194["node_modules/clsx/dist/clsx.js"]
  N195["node_modules/tailwind-merge/dist/types.d.ts"]
  N196["utils/debounce.ts"]
  N197["event-stream.test.ts"]
  N198["form-message.tsx"]
  N199["form-schemas.test.ts"]
  N200["form-schemas.ts"]
  N201["oppai-oracle-modal.tsx"]
  N202["query-state.test.ts"]
  N203["router-status.tsx"]
  N204["screen-skeleton.tsx"]
  N205["text-field.tsx"]
  N206["npm:@kobalte/core/text-field"]
  N207["import-review-modal.types.ts"]
  N208["media-sidebar-content.tsx"]
  N209["media-preview-selection.test.ts"]
  N210["media-preview-selection.ts"]
  N211["pending-downloads-indicator-core.tsx"]
  N212["pending-downloads-indicator.types.ts"]
  N213["thumbnail-source.test.ts"]
  N214["pending-downloads-indicator.tsx"]
  N215["tauri-import-review-modal.tsx"]
  N216["route-compat.test.ts"]
  N217["route-compat.ts"]
  N218["workspace/collection-inspector.tsx"]
  N219["workspace/collection-navigation.test.ts"]
  N220["workspace/search-composer-utils.ts"]
  N221["workspace/search-composer.test.ts"]
  N222["workspace/search-composer.tsx"]
  N223["workspace/search-toolbar.tsx"]
  N224["shortcuts/create-app-shortcut.ts"]
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
  N47 --> N26
  N48 --> N2
  N49 --> N11
  N49 --> N39
  N49 --> N2
  N49 --> N50
  N51 --> N11
  N51 --> N38
  N52 --> N2
  N52 --> N8
  N53 --> N2
  N53 --> N8
  N54 --> N2
  N55 --> N56
  N57 --> N2
  N57 --> N6
  N57 --> N58
  N59 --> N56
  N59 --> N2
  N60 --> N38
  N60 --> N56
  N60 --> N2
  N60 --> N6
  N60 --> N61
  N62 --> N38
  N62 --> N56
  N62 --> N2
  N62 --> N6
  N63 --> N11
  N63 --> N2
  N63 --> N9
  N63 --> N12
  N63 --> N8
  N64 --> N5
  N65 --> N56
  N65 --> N2
  N65 --> N44
  N65 --> N6
  N66 --> N11
  N66 --> N2
  N66 --> N8
  N67 --> N28
  N67 --> N29
  N67 --> N11
  N67 --> N30
  N68 --> N2
  N68 --> N6
  N69 --> N6
  N70 --> N5
  N70 --> N71
  N70 --> N2
  N70 --> N72
  N73 --> N19
  N73 --> N74
  N73 --> N2
  N73 --> N8
  N75 --> N76
  N77 --> N78
  N77 --> N28
  N77 --> N29
  N79 --> N78
  N79 --> N28
  N79 --> N29
  N79 --> N11
  N79 --> N30
  N79 --> N80
  N79 --> N2
  N79 --> N6
  N81 --> N78
  N81 --> N39
  N82 --> N28
  N82 --> N39
  N83 --> N84
  N83 --> N39
  N85 --> N29
  N85 --> N39
  N86 --> N11
  N86 --> N87
  N86 --> N39
  N88 --> N30
  N88 --> N39
  N89 --> N38
  N89 --> N39
  N90 --> N80
  N90 --> N39
  N91 --> N44
  N92 --> N39
  N92 --> N26
  N93 --> N39
  N94 --> N35
  N94 --> N26
  N94 --> N95
  N96 --> N84
  N96 --> N1
  N96 --> N71
  N96 --> N56
  N96 --> N97
  N96 --> N98
  N96 --> N99
  N96 --> N100
  N96 --> N101
  N96 --> N102
  N96 --> N103
  N96 --> N2
  N96 --> N72
  N104 --> N1
  N104 --> N2
  N104 --> N105
  N104 --> N106
  N104 --> N8
  N104 --> N107
  N104 --> N96
  N104 --> N108
  N109 --> N110
  N109 --> N106
  N109 --> N111
  N109 --> N112
  N113 --> N56
  N114 --> N2
  N115 --> N11
  N115 --> N2
  N115 --> N105
  N115 --> N6
  N115 --> N48
  N115 --> N106
  N116 --> N117
  N116 --> N2
  N116 --> N105
  N116 --> N6
  N108 --> N84
  N108 --> N118
  N119 --> N120
  N119 --> N121
  N119 --> N122
  N119 --> N97
  N119 --> N98
  N119 --> N123
  N119 --> N124
  N119 --> N125
  N119 --> N126
  N119 --> N127
  N119 --> N128
  N119 --> N99
  N119 --> N129
  N119 --> N130
  N119 --> N131
  N119 --> N132
  N119 --> N133
  N119 --> N134
  N119 --> N100
  N119 --> N101
  N119 --> N135
  N119 --> N136
  N119 --> N137
  N119 --> N103
  N119 --> N138
  N119 --> N139
  N119 --> N140
  N119 --> N141
  N119 --> N142
  N119 --> N143
  N119 --> N144
  N119 --> N145
  N119 --> N146
  N119 --> N147
  N119 --> N148
  N149 --> N29
  N149 --> N11
  N149 --> N2
  N112 --> N11
  N111 --> N11
  N150 --> N11
  N150 --> N38
  N151 --> N11
  N151 --> N2
  N151 --> N48
  N152 --> N35
  N152 --> N26
  N153 --> N35
  N154 --> N56
  N154 --> N2
  N154 --> N105
  N154 --> N9
  N154 --> N155
  N154 --> N156
  N154 --> N106
  N154 --> N157
  N154 --> N150
  N158 --> N56
  N158 --> N2
  N158 --> N105
  N158 --> N6
  N158 --> N9
  N159 --> N160
  N159 --> N106
  N159 --> N111
  N159 --> N112
  N161 --> N2
  N161 --> N6
  N161 --> N12
  N161 --> N27
  N161 --> N53
  N161 --> N162
  N161 --> N163
  N164 --> N130
  N164 --> N117
  N164 --> N2
  N164 --> N6
  N164 --> N12
  N164 --> N27
  N164 --> N52
  N164 --> N53
  N165 --> N29
  N165 --> N2
  N166 --> N2
  N166 --> N6
  N166 --> N27
  N166 --> N53
  N167 --> N168
  N167 --> N141
  N167 --> N144
  N167 --> N147
  N167 --> N2
  N167 --> N105
  N167 --> N6
  N162 --> N2
  N162 --> N3
  N162 --> N27
  N162 --> N169
  N170 --> N97
  N170 --> N171
  N170 --> N133
  N170 --> N101
  N170 --> N146
  N170 --> N2
  N170 --> N6
  N163 --> N27
  N172 --> N2
  N172 --> N6
  N172 --> N27
  N172 --> N53
  N172 --> N162
  N172 --> N163
  N173 --> N27
  N174 --> N26
  N174 --> N175
  N175 --> N28
  N175 --> N29
  N176 --> N84
  N176 --> N71
  N176 --> N2
  N176 --> N72
  N176 --> N6
  N177 --> N2
  N177 --> N105
  N177 --> N106
  N177 --> N8
  N177 --> N108
  N177 --> N176
  N156 --> N78
  N156 --> N28
  N156 --> N29
  N156 --> N30
  N156 --> N178
  N156 --> N179
  N156 --> N38
  N156 --> N80
  N156 --> N2
  N156 --> N50
  N156 --> N6
  N156 --> N53
  N156 --> N180
  N156 --> N79
  N156 --> N181
  N181 --> N78
  N181 --> N28
  N181 --> N29
  N181 --> N30
  N181 --> N179
  N181 --> N80
  N181 --> N2
  N181 --> N50
  N181 --> N3
  N181 --> N6
  N182 --> N19
  N183 --> N11
  N183 --> N2
  N183 --> N6
  N183 --> N52
  N183 --> N53
  N184 --> N6
  N185 --> N11
  N185 --> N2
  N185 --> N8
  N157 --> N11
  N186 --> N28
  N186 --> N29
  N187 --> N11
  N188 --> N26
  N189 --> N16
  N190 --> N16
  N191 --> N2
  N191 --> N8
  N192 --> N2
  N193 --> N11
  N193 --> N2
  N193 --> N192
  N14 --> N2
  N14 --> N44
  N8 --> N194
  N8 --> N195
  N196 --> N2
  N105 --> N2
  N105 --> N44
  N105 --> N6
  N105 --> N118
  N105 --> N8
  N197 --> N26
  N197 --> N46
  N198 --> N2
  N198 --> N8
  N199 --> N26
  N200 --> N72
  N201 --> N1
  N201 --> N2
  N201 --> N3
  N202 --> N26
  N202 --> N118
  N203 --> N56
  N203 --> N2
  N203 --> N105
  N203 --> N204
  N204 --> N2
  N204 --> N160
  N106 --> N2
  N106 --> N9
  N106 --> N8
  N205 --> N16
  N205 --> N206
  N205 --> N7
  N205 --> N2
  N205 --> N8
  N207 --> N11
  N207 --> N38
  N160 --> N106
  N160 --> N8
  N208 --> N28
  N208 --> N29
  N208 --> N11
  N208 --> N30
  N209 --> N26
  N209 --> N210
  N211 --> N5
  N212 --> N41
  N212 --> N38
  N212 --> N207
  N213 --> N2
  N213 --> N26
  N214 --> N2
  N214 --> N64
  N214 --> N212
  N214 --> N211
  N214 --> N8
  N215 --> N5
  N110 --> N106
  N110 --> N8
  N216 --> N26
  N216 --> N217
  N218 --> N11
  N218 --> N131
  N218 --> N148
  N218 --> N2
  N218 --> N6
  N219 --> N26
  N58 --> N2
  N107 --> N2
  N220 --> N11
  N220 --> N179
  N220 --> N31
  N221 --> N179
  N221 --> N26
  N221 --> N31
  N222 --> N144
  N222 --> N2
  N223 --> N179
  N223 --> N38
  N223 --> N120
  N223 --> N123
  N223 --> N132
  N223 --> N134
  N223 --> N137
  N223 --> N2
  N223 --> N6
  N223 --> N73
  N223 --> N156
  N223 --> N224
  N223 --> N183
```

## Diagram 2

```mermaid
graph LR
  N0["workspace/search-toolbar.tsx"]
  N1["source-media-grid.tsx"]
  N2["tauri-pending-downloads-indicator.tsx"]
  N3["node_modules/solid-js/types/index.d.ts"]
  N4["pending-downloads-indicator.types.ts"]
  N5["pending-downloads-indicator-core.tsx"]
  N6["tauri-import-review-modal.tsx"]
  N7["search-history-client.ts"]
  N8["npm:@solid-imager/core/domain/contract/search-snapshots-client"]
  N9["search-history-route.ts"]
  N10["node_modules/zod/index.d.cts"]
  N11["shortcuts/definitions.ts"]
  N12["node_modules/@tanstack/solid-hotkeys/dist/index.js"]
  N13["shortcuts/preferences-provider.tsx"]
  N14["shortcuts/preferences-storage.test.ts"]
  N15["node_modules/vitest/dist/index.js"]
  N16["shortcuts/shortcut-kbd.tsx"]
  N17["utils/cn.ts"]
  N18["shortcuts/preferences-storage.ts"]
  N19["import-source-preference.ts"]
  N20["npm:@solid-imager/core/domain/sources/schemas"]
  N0 --> N1
  N2 --> N3
  N2 --> N4
  N2 --> N5
  N2 --> N6
  N7 --> N8
  N9 --> N10
  N11 --> N12
  N13 --> N12
  N14 --> N15
  N14 --> N11
  N16 --> N12
  N16 --> N3
  N16 --> N17
  N16 --> N11
  N16 --> N13
  N16 --> N18
  N19 --> N20
```
