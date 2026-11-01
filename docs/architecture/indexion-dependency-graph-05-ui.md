# solid-imager dependencies: Shared UI

Generated 2026-11-01 from dependency-boundary fixes based on `b22d4dd6`. Indexion 0.19.0 output was checked and completed with a TypeScript/JavaScript AST scan. See the [method and findings](dependency-audit-2026-11-01.md).

Solid arrows: value imports/re-exports. Dotted arrows: explicit type-only references. `dynamic`: literal `import()` / `require()`. External modules use `external:`; workspace aliases are resolved to source files. Repeated `(source, target, kind)` edges are collapsed. These are source references, not bundler reachability results.

1,083 edges; at most 450 edges per Mermaid block.

## Part 1

```mermaid
flowchart LR
  N0["external:@kobalte/core"]
  N1["external:@kobalte/core/alert-dialog"]
  N2["external:@kobalte/core/button"]
  N3["external:@kobalte/core/checkbox"]
  N4["external:@kobalte/core/combobox"]
  N5["external:@kobalte/core/context-menu"]
  N6["external:@kobalte/core/dialog"]
  N7["external:@kobalte/core/polymorphic"]
  N8["external:@kobalte/core/popover"]
  N9["external:@tanstack/solid-query"]
  N10["external:@tanstack/solid-router"]
  N11["external:@tanstack/solid-virtual"]
  N12["external:class-variance-authority"]
  N13["external:cmdk-solid"]
  N14["external:lucide-solid/icons/scan"]
  N15["external:lucide-solid/icons/scan-face"]
  N16["external:lucide-solid/icons/trash"]
  N17["external:solid-js"]
  N18["external:solid-js/store"]
  N19["external:solid-js/web"]
  N20["external:vitest"]
  N21["external:zod"]
  N22["packages/core/src/domain/authors/schemas.ts"]
  N23["packages/core/src/domain/characters/schemas.ts"]
  N24["packages/core/src/domain/config/config-schema.ts"]
  N25["packages/core/src/domain/contract/presets-client.ts"]
  N26["packages/core/src/domain/ips/schemas.ts"]
  N27["packages/core/src/domain/jobs/schemas.ts"]
  N28["packages/core/src/domain/media/schemas.ts"]
  N29["packages/core/src/domain/media/upload-schemas.ts"]
  N30["packages/core/src/domain/projects/schemas.ts"]
  N31["packages/core/src/domain/search/embedding.ts"]
  N32["packages/core/src/domain/search/history.ts"]
  N33["packages/core/src/domain/search/logic.ts"]
  N34["packages/core/src/domain/search/schema.ts"]
  N35["packages/core/src/domain/sources/events.ts"]
  N36["packages/core/src/domain/sources/schemas.ts"]
  N37["packages/core/src/domain/tagging/schemas.ts"]
  N38["packages/core/src/domain/tags/schemas.ts"]
  N39["packages/core/src/utils/deep-equal.ts"]
  N40["packages/core/src/utils/index.ts"]
  N41["packages/ui/src/ai-tagging-modal.tsx"]
  N42["packages/ui/src/alert-dialog.tsx"]
  N43["packages/ui/src/association-manager.tsx"]
  N44["packages/ui/src/async-state.tsx"]
  N45["packages/ui/src/badge.tsx"]
  N46["packages/ui/src/bulk-action-dialog.tsx"]
  N47["packages/ui/src/button.tsx"]
  N48["packages/ui/src/card.tsx"]
  N49["packages/ui/src/character-crop-modal.tsx"]
  N50["packages/ui/src/checkbox.tsx"]
  N51["packages/ui/src/clipboard-copy.tsx"]
  N52["packages/ui/src/collapsible.tsx"]
  N53["packages/ui/src/combobox.tsx"]
  N54["packages/ui/src/command.tsx"]
  N55["packages/ui/src/context-menu.tsx"]
  N56["packages/ui/src/counter.tsx"]
  N57["packages/ui/src/dialog.tsx"]
  N58["packages/ui/src/embedding-search-controls.tsx"]
  N59["packages/ui/src/event-stream.test.ts"]
  N60["packages/ui/src/event-stream.ts"]
  N61["packages/ui/src/form-message.tsx"]
  N62["packages/ui/src/form-schemas.test.ts"]
  N63["packages/ui/src/form-schemas.ts"]
  N64["packages/ui/src/hooks/batch-job-events.types.ts"]
  N65["packages/ui/src/hooks/manager-batch-run.test.ts"]
  N66["packages/ui/src/hooks/manager-batch-run.ts"]
  N67["packages/ui/src/hooks/restore-import.ts"]
  N68["packages/ui/src/hooks/scroll-container.ts"]
  N69["packages/ui/src/hooks/stable-media-results.test.ts"]
  N70["packages/ui/src/hooks/stable-media-results.ts"]
  N71["packages/ui/src/hooks/use-batch-job-events.test.ts"]
  N72["packages/ui/src/hooks/use-batch-job-events.ts"]
  N73["packages/ui/src/hooks/use-current-search-persistence.test.ts"]
  N74["packages/ui/src/hooks/use-current-search-persistence.ts"]
  N75["packages/ui/src/hooks/use-job-events.ts"]
  N76["packages/ui/src/hooks/use-manager-page.ts"]
  N77["packages/ui/src/hooks/use-media-collection-selection.test.ts"]
  N78["packages/ui/src/hooks/use-media-collection-selection.ts"]
  N79["packages/ui/src/hooks/use-media-source-events.ts"]
  N80["packages/ui/src/hooks/use-search-history-persistence.ts"]
  N81["packages/ui/src/hooks/use-search-page.ts"]
  N82["packages/ui/src/hooks/use-source-media-page.test.ts"]
  N83["packages/ui/src/hooks/use-source-media-page.ts"]
  N84["packages/ui/src/hooks/use-source-root-path.test.ts"]
  N85["packages/ui/src/hooks/use-source-root-path.ts"]
  N86["packages/ui/src/hooks/use-sources-events.ts"]
  N87["packages/ui/src/hooks/use-sources-page.ts"]
  N88["packages/ui/src/import-inbox-helpers.ts"]
  N89["packages/ui/src/import-review-modal.tsx"]
  N90["packages/ui/src/import-review-modal.types.ts"]
  N91["packages/ui/src/import-source-preference.ts"]
  N92["packages/ui/src/inference-device-fields.tsx"]
  N93["packages/ui/src/input.tsx"]
  N94["packages/ui/src/label.tsx"]
  N95["packages/ui/src/layouts/app-shell.tsx"]
  N96["packages/ui/src/layouts/command-center.tsx"]
  N97["packages/ui/src/layouts/mobile-header.tsx"]
  N98["packages/ui/src/layouts/navigation.tsx"]
  N99["packages/ui/src/layouts/sidebar.tsx"]
  N100["packages/ui/src/layouts/source-list.tsx"]
  N101["packages/ui/src/managed-thumbnail-image.tsx"]
  N102["packages/ui/src/managed-thumbnail-source.test.ts"]
  N103["packages/ui/src/managed-thumbnail-source.ts"]
  N104["packages/ui/src/media-actions.tsx"]
  N105["packages/ui/src/media-card-item.tsx"]
  N106["packages/ui/src/media-context.test.ts"]
  N107["packages/ui/src/media-context.ts"]
  N108["packages/ui/src/media-detail-header.tsx"]
  N109["packages/ui/src/media-detail-skeleton.tsx"]
  N110["packages/ui/src/media-grid-item-link.tsx"]
  N111["packages/ui/src/media-grid-item.tsx"]
  N112["packages/ui/src/media-preview-selection.test.ts"]
  N113["packages/ui/src/media-preview-selection.ts"]
  N114["packages/ui/src/media-sidebar-content.tsx"]
  N115["packages/ui/src/media-sidebar.tsx"]
  N116["packages/ui/src/media-viewer.tsx"]
  N117["packages/ui/src/mobile-search-filter-dialog.tsx"]
  N118["packages/ui/src/move-copy-media-dialog.tsx"]
  N119["packages/ui/src/oppai-oracle-modal.tsx"]
  N120["packages/ui/src/pagination-controls.tsx"]
  N121["packages/ui/src/pending-downloads-indicator-core.tsx"]
  N122["packages/ui/src/pending-downloads-indicator.tsx"]
  N123["packages/ui/src/pending-downloads-indicator.types.ts"]
  N124["packages/ui/src/popover.tsx"]
  N125["packages/ui/src/preset-client.ts"]
  N126["packages/ui/src/preset-manager.tsx"]
  N127["packages/ui/src/pro-search-builder.tsx"]
  N128["packages/ui/src/pro-search-dialog.tsx"]
  N129["packages/ui/src/query-options/index.ts"]
  N130["packages/ui/src/query-options/jobs-query.ts"]
  N131["packages/ui/src/query-state.ts"]
  N132["packages/ui/src/search-control-panel.tsx"]
  N133["packages/ui/src/search-history-client.ts"]
  N134["packages/ui/src/select.tsx"]
  N135["packages/ui/src/shortcuts/index.ts"]
  N136["packages/ui/src/skeleton.tsx"]
  N137["packages/ui/src/source-delete-modal.tsx"]
  N138["packages/ui/src/source-form-modal.tsx"]
  N139["packages/ui/src/stores/search-store.ts"]
  N140["packages/ui/src/stores/source-scroll-store.ts"]
  N141["packages/ui/src/thumbnail-image.tsx"]
  N142["packages/ui/src/toast.tsx"]
  N143["packages/ui/src/ui-storage.ts"]
  N144["packages/ui/src/utils/cn.ts"]
  N145["packages/ui/src/utils/debounce.ts"]
  N146["packages/ui/src/utils/parse-select-value.ts"]
  N147["packages/ui/src/workspace/icons.tsx"]
  N41 --> N17
  N41 -. type .-> N37
  N41 --> N45
  N41 --> N57
  N42 --> N1
  N42 -. type .-> N17
  N42 --> N17
  N42 --> N47
  N42 --> N144
  N43 --> N17
  N43 --> N40
  N43 --> N45
  N43 --> N47
  N43 --> N54
  N43 --> N142
  N44 -. type .-> N17
  N44 --> N17
  N44 --> N19
  N44 --> N47
  N44 -. type .-> N131
  N44 --> N144
  N45 -. type .-> N12
  N45 --> N12
  N45 -. type .-> N17
  N45 --> N17
  N45 --> N144
  N46 --> N17
  N46 -. type .-> N36
  N46 --> N47
  N46 --> N57
  N46 --> N93
  N46 --> N142
  N47 --> N2
  N47 -. type .-> N7
  N47 -. type .-> N12
  N47 --> N12
  N47 -. type .-> N17
  N47 --> N17
  N47 --> N144
  N48 -. type .-> N17
  N48 --> N17
  N48 --> N144
  N49 --> N14
  N49 --> N15
  N49 --> N17
  N49 -. type .-> N28
  N49 -. type .-> N37
  N49 --> N50
  N49 --> N57
  N50 --> N3
  N50 -. type .-> N7
  N50 -. type .-> N17
  N50 --> N17
  N50 --> N144
  N51 --> N17
  N51 --> N142
  N51 --> N144
  N52 --> N0
  N53 --> N4
  N53 -. type .-> N7
  N53 --> N11
  N53 -. type .-> N17
  N53 --> N17
  N53 --> N144
  N54 -. type .-> N6
  N54 --> N13
  N54 -. type .-> N17
  N54 --> N17
  N54 --> N57
  N54 --> N144
  N55 --> N5
  N55 -. type .-> N7
  N55 -. type .-> N17
  N55 --> N17
  N55 --> N144
  N56 --> N17
  N57 --> N6
  N57 -. type .-> N7
  N57 -. type .-> N17
  N57 --> N17
  N57 --> N144
  N58 --> N17
  N58 -. type .-> N18
  N58 -. type .-> N34
  N58 --> N47
  N58 --> N93
  N58 --> N94
  N58 --> N134
  N59 --> N20
  N59 --> N60
  N61 -. type .-> N17
  N61 --> N17
  N61 --> N144
  N62 --> N20
  N62 --> N63
  N63 --> N21
  N64 -. type .-> N35
  N65 --> N20
  N65 --> N66
  N65 --> N143
  N66 --> N21
  N66 --> N31
  N66 --> N143
  N68 -. type .-> N17
  N68 --> N17
  N68 --> N19
  N69 -. type .-> N9
  N69 --> N18
  N69 --> N20
  N69 -. type .-> N28
  N69 --> N70
  N70 -. type .-> N9
  N70 -. type .-> N17
  N70 --> N17
  N70 --> N18
  N70 -. type .-> N28
  N71 --> N20
  N71 -. type .-> N35
  N71 --> N72
  N72 -. type .-> N17
  N72 --> N17
  N72 --> N19
  N72 -. type .-> N35
  N72 --> N60
  N72 -. type .-> N64
  N73 -. type .-> N17
  N73 --> N17
  N73 -. type .-> N18
  N73 -. type .-> N19
  N73 --> N20
  N73 --> N74
  N73 --> N139
  N74 --> N17
  N74 --> N19
  N74 --> N28
  N74 --> N34
  N74 --> N139
  N74 --> N143
  N75 -. type .-> N17
  N75 --> N17
  N75 --> N19
  N75 -. type .-> N35
  N75 --> N60
  N76 --> N9
  N76 --> N17
  N76 --> N19
  N76 -. type .-> N23
  N76 -. type .-> N26
  N76 -. type .-> N27
  N76 -. type .-> N28
  N76 -. type .-> N30
  N76 -. type .-> N31
  N76 -. type .-> N35
  N76 -. type .-> N36
  N76 --> N40
  N76 -. type .-> N64
  N76 --> N66
  N76 --> N129
  N76 --> N130
  N76 --> N131
  N76 --> N142
  N77 --> N20
  N77 --> N78
  N78 --> N17
  N79 --> N17
  N79 --> N19
  N79 --> N35
  N79 --> N60
  N80 -. type .-> N10
  N80 --> N10
  N80 --> N17
  N80 --> N19
  N80 -. type .-> N32
  N80 --> N32
  N80 --> N74
  N80 -. type .-> N133
  N80 --> N139
  N81 --> N9
  N81 --> N17
  N81 --> N19
  N81 -. type .-> N23
  N81 -. type .-> N26
  N81 -. type .-> N28
  N81 -. type .-> N30
  N81 -. type .-> N31
  N81 --> N34
  N81 -. type .-> N36
  N81 -. type .-> N38
  N81 --> N68
  N81 --> N129
  N81 --> N131
  N82 --> N20
  N82 --> N67
  N83 -. type .-> N9
  N83 --> N9
  N83 -. type .-> N17
  N83 --> N17
  N83 --> N19
  N83 --> N21
  N83 -. type .-> N23
  N83 -. type .-> N26
  N83 -. type .-> N28
  N83 --> N28
  N83 -. type .-> N29
  N83 -. type .-> N30
  N83 -. type .-> N31
  N83 -. type .-> N35
  N83 -. type .-> N38
  N83 --> N40
  N83 --> N68
  N83 --> N70
  N83 -. type .-> N79
  N83 --> N79
  N83 --> N129
  N83 --> N131
  N83 -. type .-> N132
  N83 --> N139
  N83 --> N140
  N83 --> N142
  N84 --> N20
  N84 --> N85
  N85 --> N9
  N85 -. type .-> N36
  N86 -. type .-> N9
  N86 --> N17
  N86 --> N19
  N86 --> N35
  N86 --> N142
  N87 -. type .-> N9
  N87 --> N17
  N87 -. type .-> N36
  N87 --> N86
  N87 --> N142
  N88 -. type .-> N28
  N88 -. type .-> N36
  N89 --> N17
  N89 --> N40
  N89 --> N42
  N89 --> N47
  N89 --> N57
  N89 --> N88
  N89 -. type .-> N90
  N89 --> N91
  N89 --> N142
  N90 -. type .-> N28
  N90 -. type .-> N36
  N91 -. type .-> N36
  N92 --> N17
  N92 --> N24
  N92 --> N61
  N92 --> N93
  N92 --> N94
  N92 --> N134
  N92 --> N144
  N93 -. type .-> N17
  N93 --> N17
  N93 --> N144
  N94 -. type .-> N17
  N94 --> N17
  N94 --> N144
  N95 -. type .-> N17
  N95 --> N17
  N95 -. type .-> N36
  N95 --> N57
  N95 -. type .-> N87
  N95 --> N96
  N95 --> N97
  N95 --> N99
  N95 --> N135
  N95 --> N137
  N95 --> N138
  N95 --> N143
  N96 --> N10
  N96 --> N17
  N96 --> N57
  N96 --> N135
  N96 --> N147
  N97 -. type .-> N17
  N97 --> N47
  N97 --> N147
  N98 --> N10
  N98 -. type .-> N17
  N98 --> N17
  N98 --> N147
  N99 --> N10
  N99 -. type .-> N17
  N99 --> N17
  N99 -. type .-> N36
  N99 --> N47
  N99 --> N98
  N99 --> N100
  N99 --> N135
  N99 --> N147
  N100 --> N10
  N100 --> N17
  N100 -. type .-> N36
  N100 --> N47
  N100 --> N52
  N100 --> N124
  N100 --> N147
  N101 --> N17
  N101 --> N103
  N101 --> N141
  N102 --> N20
  N102 --> N103
  N103 -. type .-> N141
  N104 -. type .-> N17
  N104 --> N17
  N104 -. type .-> N28
  N104 -. type .-> N31
  N104 -. type .-> N37
  N104 --> N40
  N104 --> N42
  N104 --> N47
  N104 -. type .-> N64
  N104 --> N124
  N104 --> N142
  N104 --> N147
  N105 -. type .-> N17
  N105 --> N17
  N105 -. type .-> N28
  N105 --> N48
  N105 --> N50
  N105 --> N144
  N106 --> N20
  N106 --> N107
  N106 --> N143
  N107 -. type .-> N28
  N107 --> N28
  N107 --> N143
  N108 -. type .-> N10
  N108 --> N10
  N108 -. type .-> N17
  N108 -. type .-> N28
  N108 --> N47
  N108 --> N107
  N108 --> N147
  N109 --> N136
  N109 --> N144
  N110 --> N10
  N110 --> N17
  N110 -. type .-> N28
  N110 -. type .-> N111
  N111 -. type .-> N17
  N111 --> N17
  N111 -. type .-> N28
  N111 --> N144
  N112 --> N20
  N112 --> N113
  N114 --> N9
  N114 -. type .-> N17
  N114 -. type .-> N23
  N114 -. type .-> N26
  N114 -. type .-> N28
  N114 -. type .-> N30
  N114 --> N115
  N114 --> N129
  N115 --> N10
  N115 --> N17
  N115 -. type .-> N23
  N115 -. type .-> N26
  N115 -. type .-> N28
  N115 -. type .-> N30
  N115 --> N40
  N115 --> N42
  N115 --> N43
  N115 --> N45
  N115 --> N47
  N115 --> N51
  N115 --> N52
  N115 --> N142
  N115 --> N147
  N116 --> N17
  N116 --> N47
  N116 --> N57
  N116 --> N147
  N117 --> N17
  N117 --> N18
  N117 --> N34
  N117 --> N47
  N117 --> N57
  N117 --> N132
  N117 --> N139
  N118 --> N17
  N118 --> N47
  N118 --> N57
  N118 --> N134
  N119 --> N17
  N119 -. type .-> N37
  N119 --> N45
  N119 --> N57
  N120 --> N47
  N121 --> N17
  N121 --> N40
  N121 -. type .-> N123
  N121 --> N142
  N122 --> N17
  N122 --> N89
  N122 --> N121
  N122 -. type .-> N123
  N122 --> N144
  N123 -. type .-> N35
  N123 -. type .-> N36
  N123 -. type .-> N90
  N124 -. type .-> N7
  N124 --> N8
  N124 -. type .-> N17
  N124 --> N17
  N124 --> N144
  N125 -. type .-> N25
  N125 -. type .-> N28
  N126 --> N16
  N126 --> N17
  N126 -. type .-> N18
  N126 --> N28
  N126 --> N33
  N126 --> N34
  N126 --> N39
  N126 --> N42
  N126 --> N47
  N126 --> N57
  N126 --> N93
  N126 --> N94
  N126 --> N134
  N126 --> N139
  N126 --> N142
  N126 --> N144
  N127 --> N17
  N127 -. type .-> N22
  N127 -. type .-> N23
  N127 -. type .-> N26
  N127 -. type .-> N28
  N127 -. type .-> N30
  N127 -. type .-> N38
  N127 --> N47
  N127 --> N48
  N127 --> N53
  N127 --> N93
  N127 --> N134
  N127 --> N144
  N127 --> N145
  N127 --> N146
  N128 --> N17
  N128 -. type .-> N22
  N128 -. type .-> N23
  N128 -. type .-> N26
  N128 -. type .-> N28
  N128 -. type .-> N30
  N128 -. type .-> N38
  N128 --> N47
```

## Part 2

```mermaid
flowchart LR
  N0["external:@kobalte/core/polymorphic"]
  N1["external:@kobalte/core/progress"]
  N2["external:@kobalte/core/select"]
  N3["external:@tanstack/solid-form"]
  N4["external:@tanstack/solid-hotkeys"]
  N5["external:@tanstack/solid-query"]
  N6["external:@tanstack/solid-router"]
  N7["external:@tanstack/solid-virtual"]
  N8["external:class-variance-authority"]
  N9["external:lucide-solid/icons/arrow-down-up"]
  N10["external:lucide-solid/icons/arrow-left"]
  N11["external:lucide-solid/icons/ban"]
  N12["external:lucide-solid/icons/bot"]
  N13["external:lucide-solid/icons/briefcase-business"]
  N14["external:lucide-solid/icons/chevron-down"]
  N15["external:lucide-solid/icons/chevron-left"]
  N16["external:lucide-solid/icons/chevron-right"]
  N17["external:lucide-solid/icons/circle-alert"]
  N18["external:lucide-solid/icons/circle-check"]
  N19["external:lucide-solid/icons/clock-3"]
  N20["external:lucide-solid/icons/cloud-download"]
  N21["external:lucide-solid/icons/copy-check"]
  N22["external:lucide-solid/icons/database"]
  N23["external:lucide-solid/icons/download"]
  N24["external:lucide-solid/icons/external-link"]
  N25["external:lucide-solid/icons/folder"]
  N26["external:lucide-solid/icons/funnel"]
  N27["external:lucide-solid/icons/grid-3x3"]
  N28["external:lucide-solid/icons/hard-drive"]
  N29["external:lucide-solid/icons/image"]
  N30["external:lucide-solid/icons/inbox"]
  N31["external:lucide-solid/icons/keyboard"]
  N32["external:lucide-solid/icons/library"]
  N33["external:lucide-solid/icons/list"]
  N34["external:lucide-solid/icons/logs"]
  N35["external:lucide-solid/icons/panel-left-close"]
  N36["external:lucide-solid/icons/panel-left-open"]
  N37["external:lucide-solid/icons/panels-top-left"]
  N38["external:lucide-solid/icons/pencil"]
  N39["external:lucide-solid/icons/plus"]
  N40["external:lucide-solid/icons/refresh-cw"]
  N41["external:lucide-solid/icons/rotate-ccw"]
  N42["external:lucide-solid/icons/search"]
  N43["external:lucide-solid/icons/settings"]
  N44["external:lucide-solid/icons/share-2"]
  N45["external:lucide-solid/icons/trash"]
  N46["external:lucide-solid/icons/upload"]
  N47["external:lucide-solid/icons/x"]
  N48["external:solid-js"]
  N49["external:solid-js/store"]
  N50["external:solid-js/web"]
  N51["external:vitest"]
  N52["external:zod"]
  N53["packages/core/src/domain/authors/schemas.ts"]
  N54["packages/core/src/domain/characters/schemas.ts"]
  N55["packages/core/src/domain/config/config-schema.ts"]
  N56["packages/core/src/domain/contract/search-snapshots-client.ts"]
  N57["packages/core/src/domain/ips/schemas.ts"]
  N58["packages/core/src/domain/jobs/schemas.ts"]
  N59["packages/core/src/domain/media/schemas.ts"]
  N60["packages/core/src/domain/projects/schemas.ts"]
  N61["packages/core/src/domain/search/embedding.ts"]
  N62["packages/core/src/domain/search/history.ts"]
  N63["packages/core/src/domain/search/logic.ts"]
  N64["packages/core/src/domain/search/schema.ts"]
  N65["packages/core/src/domain/shared/schemas.ts"]
  N66["packages/core/src/domain/sources/events.ts"]
  N67["packages/core/src/domain/sources/schemas.ts"]
  N68["packages/core/src/domain/tagging/schemas.ts"]
  N69["packages/core/src/domain/tags/schemas.ts"]
  N70["packages/ui/src/alert-dialog.tsx"]
  N71["packages/ui/src/async-state.tsx"]
  N72["packages/ui/src/badge.tsx"]
  N73["packages/ui/src/button.tsx"]
  N74["packages/ui/src/card.tsx"]
  N75["packages/ui/src/checkbox.tsx"]
  N76["packages/ui/src/collapsible.tsx"]
  N77["packages/ui/src/combobox.tsx"]
  N78["packages/ui/src/dialog.tsx"]
  N79["packages/ui/src/embedding-search-controls.tsx"]
  N80["packages/ui/src/form-message.tsx"]
  N81["packages/ui/src/hooks/use-manager-page.ts"]
  N82["packages/ui/src/hooks/use-media-collection-selection.ts"]
  N83["packages/ui/src/hooks/use-media-source-events.ts"]
  N84["packages/ui/src/hooks/use-search-page.ts"]
  N85["packages/ui/src/hooks/use-source-media-page.ts"]
  N86["packages/ui/src/inference-device-fields.tsx"]
  N87["packages/ui/src/input.tsx"]
  N88["packages/ui/src/label.tsx"]
  N89["packages/ui/src/managed-thumbnail-image.tsx"]
  N90["packages/ui/src/media-detail-skeleton.tsx"]
  N91["packages/ui/src/media-grid-item.tsx"]
  N92["packages/ui/src/popover.tsx"]
  N93["packages/ui/src/preset-manager.tsx"]
  N94["packages/ui/src/pro-search-builder.tsx"]
  N95["packages/ui/src/pro-search-dialog.tsx"]
  N96["packages/ui/src/progress.tsx"]
  N97["packages/ui/src/query-options/authors-query.ts"]
  N98["packages/ui/src/query-options/characters-query.ts"]
  N99["packages/ui/src/query-options/config-query.ts"]
  N100["packages/ui/src/query-options/index.ts"]
  N101["packages/ui/src/query-options/ips-query.ts"]
  N102["packages/ui/src/query-options/jobs-query.test.ts"]
  N103["packages/ui/src/query-options/jobs-query.ts"]
  N104["packages/ui/src/query-options/media-query.ts"]
  N105["packages/ui/src/query-options/prefetch.ts"]
  N106["packages/ui/src/query-options/projects-query.ts"]
  N107["packages/ui/src/query-options/query-client.test.ts"]
  N108["packages/ui/src/query-options/query-client.ts"]
  N109["packages/ui/src/query-options/search-query.test.ts"]
  N110["packages/ui/src/query-options/search-query.ts"]
  N111["packages/ui/src/query-options/sources-query.ts"]
  N112["packages/ui/src/query-options/tags-query.ts"]
  N113["packages/ui/src/query-state.test.ts"]
  N114["packages/ui/src/query-state.ts"]
  N115["packages/ui/src/router-status.tsx"]
  N116["packages/ui/src/screen-skeleton.tsx"]
  N117["packages/ui/src/screens/about-screen.tsx"]
  N118["packages/ui/src/screens/config-screen.tsx"]
  N119["packages/ui/src/screens/config-state-screen.tsx"]
  N120["packages/ui/src/screens/config-state-screen.types.ts"]
  N121["packages/ui/src/screens/design-concept-screen.tsx"]
  N122["packages/ui/src/screens/jobs-screen.tsx"]
  N123["packages/ui/src/screens/jobs-selection.test.ts"]
  N124["packages/ui/src/screens/jobs-selection.ts"]
  N125["packages/ui/src/screens/manager-screen.tsx"]
  N126["packages/ui/src/screens/manager/author-account-verification.tsx"]
  N127["packages/ui/src/screens/manager/authors.tsx"]
  N128["packages/ui/src/screens/manager/authors.types.ts"]
  N129["packages/ui/src/screens/manager/batch-tools.tsx"]
  N130["packages/ui/src/screens/manager/character-clustering-start.tsx"]
  N131["packages/ui/src/screens/manager/character-clustering.tsx"]
  N132["packages/ui/src/screens/manager/clustering-virtual-grid.tsx"]
  N133["packages/ui/src/screens/manager/data-transfer.tsx"]
  N134["packages/ui/src/screens/manager/dialogs.tsx"]
  N135["packages/ui/src/screens/manager/duplicates.tsx"]
  N136["packages/ui/src/screens/manager/entity-panel.tsx"]
  N137["packages/ui/src/screens/manager/job-status.tsx"]
  N138["packages/ui/src/screens/manager/navigation.tsx"]
  N139["packages/ui/src/screens/manager/source-select.tsx"]
  N140["packages/ui/src/screens/manager/thumbnail.tsx"]
  N141["packages/ui/src/screens/manager/types.ts"]
  N142["packages/ui/src/screens/manager/utils.test.ts"]
  N143["packages/ui/src/screens/manager/utils.ts"]
  N144["packages/ui/src/screens/media-detail-screen-core.tsx"]
  N145["packages/ui/src/screens/media-detail-screen.tsx"]
  N146["packages/ui/src/screens/media-detail-screen.types.ts"]
  N147["packages/ui/src/screens/not-found-screen.tsx"]
  N148["packages/ui/src/screens/search-screen.tsx"]
  N149["packages/ui/src/screens/search-screen.types.ts"]
  N150["packages/ui/src/screens/source-media-screen.tsx"]
  N151["packages/ui/src/screens/source-media-screen.types.ts"]
  N152["packages/ui/src/search-control-panel.tsx"]
  N153["packages/ui/src/search-filters.tsx"]
  N154["packages/ui/src/search-history-client.ts"]
  N155["packages/ui/src/search-history-route.ts"]
  N156["packages/ui/src/select.tsx"]
  N157["packages/ui/src/shortcuts/create-app-shortcut.ts"]
  N158["packages/ui/src/shortcuts/definitions.ts"]
  N159["packages/ui/src/shortcuts/index.ts"]
  N160["packages/ui/src/shortcuts/preferences-provider.tsx"]
  N161["packages/ui/src/shortcuts/preferences-storage.test.ts"]
  N162["packages/ui/src/shortcuts/preferences-storage.ts"]
  N163["packages/ui/src/shortcuts/shortcut-kbd.tsx"]
  N164["packages/ui/src/shortcuts/shortcut-settings-panel.tsx"]
  N165["packages/ui/src/skeleton.tsx"]
  N166["packages/ui/src/sort-controls.tsx"]
  N167["packages/ui/src/source-media-grid.tsx"]
  N168["packages/ui/src/stores/search-store.ts"]
  N169["packages/ui/src/switch.tsx"]
  N170["packages/ui/src/tabs.tsx"]
  N171["packages/ui/src/text-field.tsx"]
  N172["packages/ui/src/textarea.tsx"]
  N173["packages/ui/src/thumbnail-image.tsx"]
  N174["packages/ui/src/thumbnail-source.ts"]
  N175["packages/ui/src/toast.tsx"]
  N176["packages/ui/src/ui-storage.ts"]
  N177["packages/ui/src/utils/cn.ts"]
  N178["packages/ui/src/utils/debounce.ts"]
  N179["packages/ui/src/workspace/collection-inspector.tsx"]
  N180["packages/ui/src/workspace/collection-navigation.ts"]
  N181["packages/ui/src/workspace/management-layout.tsx"]
  N182["packages/ui/src/workspace/search-toolbar.tsx"]
  N95 --> N78
  N95 --> N94
  N96 --> N1
  N96 -. type .-> N48
  N96 --> N48
  N96 --> N177
  N97 --> N5
  N97 -. type .-> N53
  N98 --> N5
  N98 -. type .-> N54
  N99 --> N5
  N99 -. type .-> N55
  N100 --> N97
  N100 --> N98
  N100 --> N99
  N100 --> N101
  N100 --> N103
  N100 --> N104
  N100 --> N105
  N100 --> N106
  N100 --> N108
  N100 --> N110
  N100 --> N111
  N100 --> N112
  N101 --> N5
  N101 -. type .-> N57
  N102 --> N51
  N102 -. type .-> N58
  N102 --> N103
  N103 --> N5
  N103 -. type .-> N58
  N103 -. type .-> N66
  N104 --> N5
  N104 -. type .-> N59
  N104 -. type .-> N65
  N105 --> N50
  N106 --> N5
  N106 -. type .-> N60
  N107 --> N5
  N107 --> N51
  N107 --> N108
  N108 -. type .-> N5
  N109 --> N5
  N109 --> N51
  N109 -. type .-> N59
  N109 --> N110
  N110 --> N5
  N110 -. type .-> N59
  N110 -. type .-> N61
  N111 --> N5
  N111 -. type .-> N67
  N112 --> N5
  N112 -. type .-> N69
  N113 --> N51
  N113 --> N114
  N115 -. type .-> N6
  N115 --> N6
  N115 --> N48
  N115 --> N71
  N115 --> N116
  N116 --> N48
  N116 --> N90
  N116 --> N165
  N116 --> N177
  N117 --> N72
  N117 --> N73
  N117 --> N74
  N118 --> N3
  N118 --> N6
  N118 --> N12
  N118 --> N13
  N118 --> N20
  N118 --> N28
  N118 --> N29
  N118 --> N31
  N118 --> N34
  N118 --> N48
  N118 -. type .-> N52
  N118 -. type .-> N55
  N118 --> N55
  N118 -. type .-> N68
  N118 --> N70
  N118 --> N73
  N118 --> N80
  N118 --> N86
  N118 --> N87
  N118 --> N88
  N118 --> N164
  N118 --> N169
  N118 --> N170
  N118 --> N172
  N118 --> N175
  N118 --> N181
  N119 --> N48
  N119 -. type .-> N68
  N119 --> N71
  N119 --> N118
  N119 -. type .-> N120
  N119 --> N165
  N119 --> N177
  N119 --> N181
  N120 -. type .-> N55
  N120 -. type .-> N114
  N121 --> N9
  N121 --> N10
  N121 --> N11
  N121 --> N12
  N121 --> N13
  N121 --> N14
  N121 --> N15
  N121 --> N16
  N121 --> N17
  N121 --> N18
  N121 --> N19
  N121 --> N20
  N121 --> N22
  N121 --> N23
  N121 --> N24
  N121 --> N25
  N121 --> N26
  N121 --> N27
  N121 --> N28
  N121 --> N29
  N121 --> N30
  N121 --> N32
  N121 --> N33
  N121 --> N34
  N121 --> N35
  N121 --> N36
  N121 --> N37
  N121 --> N39
  N121 --> N40
  N121 --> N41
  N121 --> N42
  N121 --> N43
  N121 --> N44
  N121 --> N45
  N121 --> N47
  N121 --> N48
  N121 --> N49
  N121 --> N70
  N121 --> N72
  N121 --> N73
  N121 --> N76
  N121 --> N78
  N121 --> N87
  N121 --> N88
  N121 --> N92
  N121 --> N96
  N121 --> N169
  N121 --> N175
  N122 --> N11
  N122 --> N15
  N122 --> N16
  N122 --> N17
  N122 --> N18
  N122 --> N19
  N122 --> N23
  N122 --> N40
  N122 --> N41
  N122 -. type .-> N48
  N122 --> N48
  N122 --> N58
  N122 --> N71
  N122 --> N72
  N122 --> N73
  N122 --> N75
  N122 -. type .-> N114
  N122 --> N124
  N122 --> N143
  N122 --> N156
  N122 --> N165
  N122 --> N170
  N122 --> N173
  N122 --> N174
  N122 --> N181
  N123 --> N51
  N123 -. type .-> N58
  N123 --> N124
  N124 -. type .-> N58
  N125 --> N48
  N125 --> N71
  N125 --> N73
  N125 -. type .-> N81
  N125 --> N127
  N125 -. type .-> N128
  N125 --> N129
  N125 --> N131
  N125 --> N133
  N125 --> N134
  N125 --> N135
  N125 --> N136
  N125 --> N138
  N125 --> N140
  N125 -. type .-> N141
  N125 --> N143
  N125 --> N181
  N126 --> N5
  N126 --> N48
  N126 -. type .-> N53
  N126 --> N73
  N126 --> N75
  N126 --> N78
  N126 -. type .-> N128
  N126 --> N171
  N127 --> N5
  N127 --> N48
  N127 -. type .-> N53
  N127 --> N71
  N127 --> N73
  N127 --> N75
  N127 --> N77
  N127 --> N78
  N127 --> N88
  N127 --> N89
  N127 --> N126
  N127 -. type .-> N128
  N127 --> N156
  N127 --> N171
  N127 --> N178
  N128 -. type .-> N53
  N129 --> N48
  N129 --> N73
  N129 --> N75
  N129 -. type .-> N81
  N129 --> N88
  N129 --> N137
  N129 --> N139
  N129 --> N156
  N130 --> N5
  N130 --> N48
  N130 --> N54
  N130 --> N73
  N130 --> N156
  N130 --> N171
  N131 --> N5
  N131 --> N48
  N131 -. type .-> N54
  N131 --> N71
  N131 --> N72
  N131 --> N73
  N131 --> N78
  N131 --> N89
  N131 --> N130
  N131 --> N132
  N131 --> N156
  N131 --> N165
  N131 --> N171
  N132 --> N7
  N132 --> N48
  N132 --> N165
  N133 --> N23
  N133 --> N46
  N133 --> N48
  N133 --> N73
  N133 --> N75
  N133 -. type .-> N81
  N133 --> N87
  N133 --> N88
  N133 -. type .-> N141
  N133 --> N156
  N134 --> N48
  N134 -. type .-> N57
  N134 --> N70
  N134 --> N73
  N134 --> N77
  N134 --> N78
  N134 -. type .-> N81
  N134 --> N87
  N134 --> N88
  N134 --> N143
  N135 --> N48
  N135 --> N73
  N135 -. type .-> N81
  N135 --> N88
  N135 --> N143
  N135 --> N156
  N136 --> N38
  N136 --> N39
  N136 --> N42
  N136 --> N45
  N136 --> N48
  N136 --> N71
  N136 --> N73
  N136 -. type .-> N81
  N136 --> N87
  N136 --> N143
  N136 --> N165
  N137 --> N48
  N137 --> N72
  N137 -. type .-> N81
  N137 --> N96
  N138 --> N12
  N138 --> N21
  N138 --> N25
  N138 --> N29
  N138 --> N44
  N138 --> N48
  N138 --> N73
  N138 --> N141
  N138 --> N181
  N139 -. type .-> N81
  N139 --> N156
  N140 --> N48
  N140 --> N73
  N140 -. type .-> N81
  N140 --> N88
  N140 --> N137
  N140 --> N139
  N141 -. type .-> N81
  N142 --> N51
  N142 --> N143
  N143 -. type .-> N54
  N143 -. type .-> N57
  N143 -. type .-> N81
  N143 --> N141
  N144 --> N5
  N144 -. type .-> N48
  N144 --> N48
  N144 --> N49
  N144 -. type .-> N59
  N144 -. type .-> N66
  N144 --> N71
  N144 --> N83
  N144 --> N114
  N144 -. type .-> N146
  N145 -. type .-> N48
  N145 --> N48
  N145 --> N90
  N145 --> N144
  N145 -. type .-> N146
  N145 --> N165
  N146 -. type .-> N5
  N146 -. type .-> N48
  N146 -. type .-> N59
  N146 -. type .-> N66
  N146 -. type .-> N83
  N147 --> N6
  N148 -. type .-> N48
  N148 --> N48
  N148 -. type .-> N59
  N148 --> N71
  N148 --> N73
  N148 -. type .-> N82
  N148 -. type .-> N149
  N148 --> N165
  N148 --> N167
  N148 --> N176
  N148 --> N179
  N148 --> N180
  N148 --> N182
  N149 -. type .-> N48
  N149 -. type .-> N59
  N149 -. type .-> N61
  N149 -. type .-> N67
  N149 -. type .-> N84
  N149 -. type .-> N85
  N149 -. type .-> N91
  N150 --> N46
  N150 --> N48
  N150 -. type .-> N59
  N150 --> N71
  N150 --> N73
  N150 --> N78
  N150 -. type .-> N151
  N150 --> N165
  N150 --> N167
  N150 --> N176
  N150 --> N179
  N150 --> N180
  N150 --> N182
  N151 -. type .-> N48
  N151 -. type .-> N59
  N151 -. type .-> N61
  N151 -. type .-> N66
  N151 -. type .-> N82
  N151 -. type .-> N85
  N151 -. type .-> N91
  N152 --> N48
  N152 -. type .-> N49
  N152 -. type .-> N53
  N152 -. type .-> N54
  N152 -. type .-> N57
  N152 -. type .-> N60
  N152 --> N63
  N152 -. type .-> N64
  N152 -. type .-> N67
  N152 -. type .-> N69
  N152 --> N73
  N152 --> N79
  N152 --> N88
  N152 --> N93
  N152 --> N95
  N152 --> N153
  N152 --> N156
  N152 --> N166
  N152 --> N168
  N153 --> N48
  N153 -. type .-> N49
  N153 -. type .-> N53
  N153 -. type .-> N54
  N153 -. type .-> N57
  N153 -. type .-> N60
  N153 -. type .-> N64
  N153 -. type .-> N69
  N153 --> N72
  N153 --> N73
  N153 --> N77
  N153 --> N88
  N153 --> N171
  N153 --> N177
  N153 --> N178
  N154 -. type .-> N56
  N154 -. type .-> N62
  N155 --> N52
  N156 -. type .-> N0
  N156 --> N2
  N156 --> N8
  N156 -. type .-> N48
  N156 --> N48
  N156 --> N177
  N157 --> N4
  N157 --> N158
  N157 --> N160
  N158 -. type .-> N4
  N159 --> N157
  N159 --> N158
  N159 --> N160
  N159 --> N162
  N159 --> N163
  N159 --> N164
  N160 --> N4
  N160 --> N48
  N160 --> N158
  N160 --> N162
  N161 --> N51
  N161 --> N158
  N161 --> N162
  N162 --> N4
  N162 --> N158
  N163 --> N4
  N163 --> N48
  N163 -. type .-> N158
  N163 --> N160
  N163 -. type .-> N162
  N163 --> N177
  N164 --> N4
  N164 --> N48
  N164 --> N73
  N164 --> N87
```

## Part 3

```mermaid
flowchart LR
  N0["external:@kobalte/core"]
  N1["external:@kobalte/core/menu"]
  N2["external:@kobalte/core/switch"]
  N3["external:@kobalte/core/tabs"]
  N4["external:@kobalte/core/text-field"]
  N5["external:@tanstack/solid-form"]
  N6["external:@tanstack/solid-query"]
  N7["external:@tanstack/solid-virtual"]
  N8["external:class-variance-authority"]
  N9["external:clsx"]
  N10["external:lucide-solid/icons/arrow-down-up"]
  N11["external:lucide-solid/icons/chevron-down"]
  N12["external:lucide-solid/icons/copy"]
  N13["external:lucide-solid/icons/external-link"]
  N14["external:lucide-solid/icons/folder-input"]
  N15["external:lucide-solid/icons/funnel"]
  N16["external:lucide-solid/icons/grid-3x3"]
  N17["external:lucide-solid/icons/list"]
  N18["external:lucide-solid/icons/list-checks"]
  N19["external:lucide-solid/icons/search"]
  N20["external:lucide-solid/icons/square-check"]
  N21["external:lucide-solid/icons/x"]
  N22["external:solid-js"]
  N23["external:solid-js/store"]
  N24["external:solid-js/web"]
  N25["external:solid-sonner"]
  N26["external:tailwind-merge"]
  N27["external:vitest"]
  N28["external:zod"]
  N29["packages/core/src/domain/authors/schemas.ts"]
  N30["packages/core/src/domain/characters/schemas.ts"]
  N31["packages/core/src/domain/ips/schemas.ts"]
  N32["packages/core/src/domain/media/schemas.ts"]
  N33["packages/core/src/domain/projects/schemas.ts"]
  N34["packages/core/src/domain/search/embedding.ts"]
  N35["packages/core/src/domain/search/logic.ts"]
  N36["packages/core/src/domain/search/schema.ts"]
  N37["packages/core/src/domain/sources/schemas.ts"]
  N38["packages/core/src/domain/tags/schemas.ts"]
  N39["packages/core/src/utils/index.ts"]
  N40["packages/ui/src/alert-dialog.tsx"]
  N41["packages/ui/src/async-state.tsx"]
  N42["packages/ui/src/button.tsx"]
  N43["packages/ui/src/card.tsx"]
  N44["packages/ui/src/combobox.tsx"]
  N45["packages/ui/src/context-menu.tsx"]
  N46["packages/ui/src/dialog.tsx"]
  N47["packages/ui/src/form-message.tsx"]
  N48["packages/ui/src/form-schemas.ts"]
  N49["packages/ui/src/hooks/use-media-collection-selection.ts"]
  N50["packages/ui/src/hooks/use-media-source-events.ts"]
  N51["packages/ui/src/hooks/use-search-history-persistence.ts"]
  N52["packages/ui/src/hooks/use-search-page.ts"]
  N53["packages/ui/src/hooks/use-source-media-page.ts"]
  N54["packages/ui/src/input.tsx"]
  N55["packages/ui/src/label.tsx"]
  N56["packages/ui/src/media-grid-item.tsx"]
  N57["packages/ui/src/media-preview-selection.ts"]
  N58["packages/ui/src/popover.tsx"]
  N59["packages/ui/src/query-state.ts"]
  N60["packages/ui/src/screens/source-media-screen.tsx"]
  N61["packages/ui/src/screens/source-media-screen.types.ts"]
  N62["packages/ui/src/search-control-panel.tsx"]
  N63["packages/ui/src/search-history-client.ts"]
  N64["packages/ui/src/select.tsx"]
  N65["packages/ui/src/shortcuts/create-app-shortcut.ts"]
  N66["packages/ui/src/shortcuts/definitions.ts"]
  N67["packages/ui/src/shortcuts/preferences-provider.tsx"]
  N68["packages/ui/src/shortcuts/shortcut-kbd.tsx"]
  N69["packages/ui/src/shortcuts/shortcut-settings-panel.tsx"]
  N70["packages/ui/src/skeleton.tsx"]
  N71["packages/ui/src/sort-controls.tsx"]
  N72["packages/ui/src/source-delete-modal.tsx"]
  N73["packages/ui/src/source-form-modal.tsx"]
  N74["packages/ui/src/source-media-grid.tsx"]
  N75["packages/ui/src/source-media-page.tsx"]
  N76["packages/ui/src/stores/search-store.test.ts"]
  N77["packages/ui/src/stores/search-store.ts"]
  N78["packages/ui/src/stores/source-scroll-store.ts"]
  N79["packages/ui/src/switch.tsx"]
  N80["packages/ui/src/tabs.tsx"]
  N81["packages/ui/src/text-field.tsx"]
  N82["packages/ui/src/textarea.tsx"]
  N83["packages/ui/src/thumbnail-image.tsx"]
  N84["packages/ui/src/thumbnail-source.test.ts"]
  N85["packages/ui/src/thumbnail-source.ts"]
  N86["packages/ui/src/toast.tsx"]
  N87["packages/ui/src/ui-storage.test.ts"]
  N88["packages/ui/src/ui-storage.ts"]
  N89["packages/ui/src/upload-media-modal-content.tsx"]
  N90["packages/ui/src/upload-media-modal-content.types.ts"]
  N91["packages/ui/src/upload-media-modal.tsx"]
  N92["packages/ui/src/utils/cn.ts"]
  N93["packages/ui/src/utils/debounce.ts"]
  N94["packages/ui/src/utils/index.ts"]
  N95["packages/ui/src/utils/parse-select-value.ts"]
  N96["packages/ui/src/workspace/collection-inspector.tsx"]
  N97["packages/ui/src/workspace/collection-navigation.test.ts"]
  N98["packages/ui/src/workspace/collection-navigation.ts"]
  N99["packages/ui/src/workspace/icons.tsx"]
  N100["packages/ui/src/workspace/management-layout.tsx"]
  N101["packages/ui/src/workspace/search-composer-utils.ts"]
  N102["packages/ui/src/workspace/search-composer.test.ts"]
  N103["packages/ui/src/workspace/search-composer.tsx"]
  N104["packages/ui/src/workspace/search-toolbar.tsx"]
  N69 --> N66
  N69 --> N67
  N69 --> N68
  N69 --> N92
  N70 -. type .-> N22
  N70 --> N22
  N70 --> N43
  N70 --> N92
  N71 --> N22
  N71 -. type .-> N32
  N71 --> N42
  N71 --> N54
  N71 --> N55
  N71 --> N64
  N71 --> N95
  N72 --> N42
  N72 --> N46
  N73 --> N5
  N73 --> N22
  N73 -. type .-> N37
  N73 --> N39
  N73 --> N40
  N73 --> N42
  N73 --> N46
  N73 --> N47
  N73 --> N48
  N73 --> N54
  N73 --> N55
  N73 --> N64
  N73 --> N81
  N73 --> N95
  N74 --> N1
  N74 --> N7
  N74 --> N12
  N74 --> N13
  N74 --> N14
  N74 --> N18
  N74 --> N20
  N74 --> N21
  N74 -. type .-> N22
  N74 --> N22
  N74 -. type .-> N32
  N74 -. type .-> N34
  N74 --> N41
  N74 --> N45
  N74 -. type .-> N49
  N74 -. type .-> N56
  N74 --> N57
  N74 -. type .-> N59
  N74 --> N70
  N74 --> N98
  N74 --> N99
  N75 --> N6
  N75 --> N22
  N75 --> N24
  N75 -. type .-> N30
  N75 -. type .-> N31
  N75 -. type .-> N32
  N75 -. type .-> N33
  N75 -. type .-> N34
  N75 -. type .-> N38
  N75 -. type .-> N49
  N75 -. type .-> N50
  N75 --> N51
  N75 --> N53
  N75 --> N59
  N75 --> N60
  N75 -. type .-> N61
  N75 -. type .-> N63
  N76 --> N27
  N76 --> N77
  N77 --> N23
  N77 -. type .-> N32
  N77 -. type .-> N34
  N77 --> N35
  N77 --> N36
  N77 --> N88
  N78 --> N23
  N78 --> N28
  N79 -. type .-> N0
  N79 --> N2
  N79 -. type .-> N22
  N79 --> N22
  N79 --> N92
  N80 -. type .-> N0
  N80 --> N3
  N80 -. type .-> N22
  N80 --> N22
  N80 --> N92
  N81 -. type .-> N0
  N81 --> N4
  N81 --> N8
  N81 -. type .-> N22
  N81 --> N22
  N81 --> N92
  N82 -. type .-> N22
  N82 --> N22
  N82 --> N92
  N83 --> N22
  N84 --> N22
  N84 --> N27
  N84 --> N85
  N85 --> N22
  N85 -. type .-> N32
  N85 -. type .-> N83
  N86 --> N22
  N86 --> N24
  N86 -->|dynamic| N25
  N86 -. type .-> N25
  N87 --> N27
  N87 --> N88
  N89 -. type .-> N90
  N89 --> N91
  N91 --> N5
  N91 --> N22
  N91 --> N28
  N91 --> N39
  N91 --> N40
  N91 --> N42
  N91 --> N46
  N91 --> N47
  N91 --> N48
  N91 --> N54
  N91 --> N55
  N92 --> N9
  N92 --> N26
  N93 --> N22
  N94 --> N92
  N94 --> N93
  N94 --> N95
  N96 --> N13
  N96 --> N21
  N96 -. type .-> N22
  N96 --> N22
  N96 -. type .-> N32
  N96 --> N42
  N97 --> N27
  N97 --> N98
  N99 -. type .-> N22
  N99 --> N22
  N100 -. type .-> N22
  N100 --> N22
  N101 --> N32
  N101 -. type .-> N36
  N101 -. type .-> N52
  N102 --> N27
  N102 --> N36
  N102 -. type .-> N52
  N102 --> N101
  N103 --> N19
  N103 -. type .-> N22
  N103 --> N22
  N103 --> N44
  N103 -. type .-> N52
  N103 --> N55
  N103 --> N68
  N103 --> N93
  N103 -. type .-> N101
  N103 --> N101
  N104 --> N10
  N104 --> N11
  N104 --> N15
  N104 --> N16
  N104 --> N17
  N104 -. type .-> N22
  N104 --> N22
  N104 -. type .-> N29
  N104 -. type .-> N30
  N104 -. type .-> N31
  N104 -. type .-> N33
  N104 -. type .-> N36
  N104 -. type .-> N37
  N104 -. type .-> N38
  N104 --> N42
  N104 --> N58
  N104 -. type .-> N62
  N104 --> N62
  N104 --> N65
  N104 --> N71
  N104 -. type .-> N74
  N104 --> N77
  N104 --> N101
  N104 --> N103
```
