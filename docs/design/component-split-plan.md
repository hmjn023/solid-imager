# Component Split Plan

## 背景と目的

`apps/server` と `apps/tauri` の共通化を進める前に、巨大なJSXファイルを責務ごとに分割する。これにより:

- 共通化の単位を明確にする
- `packages/ui` への切り出し候補を見える化する
- テスト・保守性を向上させる

## 対象ファイル一覧

### Server側

| ファイル                                  | 行数  | 優先度 |
| ----------------------------------------- | ----- | ------ |
| `routes/sources/$mediaSourceId/index.tsx` | 1,126 | **P0** |
| `components/media/media-sidebar.tsx`      | 519   | **P0** |
| `routes/config.tsx`                       | 569   | **P1** |
| `components/source-form-modal.tsx`        | 430   | **P1** |
| `components/upload-media-modal.tsx`       | 333   | **P1** |

### Tauri側

| ファイル                                  | 行数  | 優先度 |
| ----------------------------------------- | ----- | ------ |
| `routes/sources/$mediaSourceId/index.tsx` | 1,027 | **P0** |
| `components/media/media-sidebar.tsx`      | 449   | **P0** |
| `routes/config.tsx`                       | 483   | **P1** |
| `components/source-form-modal.tsx`        | 149   | **P2** |
| `components/upload-media-modal.tsx`       | 260   | **P1** |

## 分割方針

### 原則

1. **Container/Presentational 分離**: Data fetching と state management は hook/container に、描画は presentational component に分離
2. **Feature-based 分割**: 機能単位（upload, search, association など）でファイルを分ける
3. **server側を基準**: 分割後の命名・責務分割は server 側を正とし、tauri 側が追従
4. **route は薄く**: route ファイルは layout と data loader の宣言のみに留め、logic は hook/component に委譲

---

## P0: `routes/sources/$mediaSourceId/index.tsx` の分割

### 現状の責務

- Query/Data Fetching (infinite scroll, filter data)
- Scroll Restoration
- Upload Handling (file select, drag&drop, clipboard paste)
- Download/Restore (dump JSON/ZIP, restore)
- CRUD Operations (delete, copy, move, sync)
- SSE Event Handling
- UI State Management (modals, dialogs, context menu)
- JSX (grid, sidebar, nav portal)

### 分割後の構成

```
apps/server/src/routes/sources/$mediaSourceId/
├── index.tsx              # Route definition + page layout (100行程度)
├── hooks/
│   ├── use-media-query.ts       # Infinite query, search params
│   ├── use-scroll-restoration.ts # Scroll save/restore
│   ├── use-media-upload.ts      # File/URL/JSON upload logic
│   ├── use-media-dump.ts        # Dump download & restore
│   ├── use-media-operations.ts  # Delete, copy, move, sync
│   └── use-media-source-events.ts # SSE event handlers (既存)
└── components/
    ├── media-list-layout.tsx    # Grid + sidebar layout
    ├── media-grid.tsx           # Virtual/infinite grid only
    ├── media-context-menu.tsx   # Right-click menu
    └── media-list-actions.tsx   # Nav portal buttons (dump/restore/filter)
```

### 各ファイルの責務

#### `index.tsx`

- `createFileRoute` の定義
- `loader`（prefetch）
- ページレイアウトの組み立て
- 各 hook の呼び出しと props 受け渡し

#### `hooks/use-media-query.ts`

- `createInfiniteQuery` の設定
- `searchParams` / `searchConditionKey` の memoization
- `MEDIA_ITEMS_PER_PAGE` 定数

#### `hooks/use-scroll-restoration.ts`

- `history.scrollRestoration = "manual"`
- `getScrollPosition` / `setScrollPosition`
- `IntersectionObserver` による無限スクロールトリガー

#### `hooks/use-media-upload.ts`

- `handleFileSelect`
- `handleDrop` / `handleDragOver`
- `handlePaste` / `processClipboardItems`
- `handleJsonFileUpload`
- Upload modal 用 state (`showUploadModal`, `fileToUpload`, `pastedUrl`)

#### `hooks/use-media-dump.ts`

- `handleDumpDownload` (json/zip)
- `handleRestoreSelect` (file input → restore/import)

#### `hooks/use-media-operations.ts`

- `handleDelete` / `confirmDelete`
- `handleCopyMove` / `handleConfirmCopyMove`
- `handleSyncLoadedMedia` / `handleSyncSingleMedia`
- Move/Copy dialog state

#### `components/media-list-layout.tsx`

- 2カラムレイアウト（sidebar + grid）
- Drag&Drop イベントハンドラの設置

#### `components/media-grid.tsx`

- メディアグリッドの描画
- `ThumbnailImage` の配置
- 無限スクロールトリガー要素

#### `components/media-context-menu.tsx`

- `ContextMenu` コンポーネント
- メニュー項目（Open, Delete, Copy, Move, Sync）

#### `components/media-list-actions.tsx`

- `Portal` によるナビゲーションボタン
- Dump/Restore/Filter ボタン

---

## P0: `components/media/media-sidebar.tsx` の分割

### 現状の責務

- 基本情報表示（ファイル名、解像度、サイズ）
- 説明のインライン編集
- Source URLs 表示
- Authors 表示
- Project / IP / Character 関連付け（AssociationManager）
- Positive / Negative Tags 表示
- Generation Info（ComfyUI）の折りたたみ表示

### 分割後の構成

```
apps/server/src/components/media/media-sidebar/
├── index.tsx                    # Sidebar layout + 子コンポーネント組み立て
├── sections/
│   ├── media-basic-info.tsx     # ファイル名、解像度、サイズ
│   ├── media-description.tsx    # 説明表示・編集
│   ├── media-source-urls.tsx    # Source URLs リスト
│   ├── media-authors.tsx        # Authors リスト
│   ├── media-tags.tsx           # Positive/Negative Tags
│   └── media-generation-info.tsx # ComfyUI workflow など
└── hooks/
    └── use-media-associations.ts # Project/IP/Character CRUD
```

### 各ファイルの責務

#### `index.tsx`

- `aside` レイアウト
- AI Tagging ボタン
- 各 section コンポーネントの配置
- `AssociationManager` は `use-media-associations.ts` のラッパーとして残すか、または section コンポーネント内に含める

#### `sections/media-description.tsx`

- `isEditingDescription` state
- `handleSaveDescription` / `handleCancelEdit`
- textarea / 表示切り替え

#### `sections/media-tags.tsx`

- Positive / Negative の分類
- `Badge` コンポーネント
- `ClipboardCopy`
- Source による色分けロジック

#### `sections/media-generation-info.tsx`

- `Collapsible` ラップ
- Prompt / Negative Prompt / Workflow の表示
- `ClipboardCopy`

#### `hooks/use-media-associations.ts`

- Project / IP / Character の add/remove/create
- `availableCharacters` の memoization（IPフィルタ）
- Auto-assign IPs on character add

---

## P1: `routes/config.tsx` の分割

### 現状の責務

- フォーム定義（`createForm`）
- 6つのタブ（Jobs, AI, Downloads, Storage, Media, Logging）
- 各タブ内のフィールド定義

### 分割後の構成

```
apps/server/src/routes/
├── config.tsx                   # Route + ConfigPage wrapper
└── config/
    ├── config-form.tsx          # createForm + submit handler
    ├── tabs/
    │   ├── jobs-tab.tsx
    │   ├── ai-tab.tsx
    │   ├── downloads-tab.tsx
    │   ├── storage-tab.tsx
    │   ├── media-tab.tsx
    │   └── logging-tab.tsx
    └── fields/
        ├── number-field.tsx     # 共通 number input wrapper
        ├── string-field.tsx     # 共通 text input wrapper
        ├── switch-field.tsx     # 共通 switch wrapper
        └── string-list-field.tsx # 共通 comma-separated textarea wrapper
```

### 各ファイルの責務

#### `config.tsx`

- Route 定義
- `ConfigPage`（loading/error/data の状態管理）

#### `config-form.tsx`

- `createForm` の設定
- Tabs の切り替え
- Save ボタン

#### `tabs/*.tsx`

- 各タブのコンテンツ（fieldset 相当）
- `form.Field` の呼び出し

#### `fields/*.tsx`

- `form.Field` の render prop を共通化
- Number / String / Switch / StringList の4種類
- これらは `packages/ui` への昇格候補

---

## P1: `components/upload-media-modal.tsx` の分割

### 現状の責務

- モーダル表示制御
- ファイルアップロードフォーム
- URL からのフェッチ
- オプション入力（filename, description, overwrite, autoIncrement）

### 分割後の構成

```
apps/server/src/components/upload-media-modal/
├── index.tsx              # Modal shell + state
├── upload-file-form.tsx   # File upload specific form
└── upload-url-form.tsx    # URL fetch form
```

---

## P1: `components/source-form-modal.tsx` の分割

### 現状の責務

- ソース作成/編集フォーム
- ストレージタイプによる条件分岐
- 検証ロジック

### 分割後の構成

```
apps/server/src/components/source-form-modal/
├── index.tsx              # Modal shell + form state
├── source-type-selector.tsx
├── fields/
│   ├── local-fields.tsx
│   ├── sftp-fields.tsx
│   └── s3-fields.tsx
└── hooks/
    └── use-source-form.ts # Validation + submit logic
```

---

## Tauri側の追従

server側の分割完了後、tauri側を同じ構造に追従させる。

### 注意点

- tauri側の `routes/sources/$mediaSourceId/index.tsx` は virtual scroll を使用している（`createWindowVirtualizer`）
- 分割時は `media-grid.tsx` の実装に差分が出る可能性がある
- hook 層は共通化を見据えて **server側の命名・インターフェースに揃える**

---

## 作業順序

### Phase 1: P0 分割（server側）

1. `routes/sources/$mediaSourceId/index.tsx` の hook 切り出し
2. `routes/sources/$mediaSourceId/index.tsx` の component 切り出し
3. `components/media/media-sidebar.tsx` の section 切り出し
4. `components/media/media-sidebar.tsx` の hook 切り出し

### Phase 2: P0 追従（tauri側）

5. tauri `routes/sources/$mediaSourceId/index.tsx` を server 側の構造に揃えて分割
6. tauri `components/media/media-sidebar.tsx` を server 側の構造に揃えて分割

### Phase 3: P1 分割（両方）

7. `routes/config.tsx` の分割（両方）
8. `components/upload-media-modal.tsx` の分割（両方）
9. `components/source-form-modal.tsx` の分割（server側のみ、tauriは既に小さい）

### Phase 4: 共通化準備

10. `packages/ui` への昇格候補の抽出（`fields/*`, `media-sidebar/sections/*` など）
11. `packages/application` への hook 昇格候補の抽出

---

## 命名規則

- **Hook**: `use-{feature}-{subfeature}.ts`（例: `use-media-upload.ts`）
- **Component**: `{feature}-{role}.tsx`（例: `media-grid.tsx`, `media-context-menu.tsx`）
- **Section**: `{domain}-{content}-section.tsx` または `{domain}-{content}.tsx`（例: `media-tags.tsx`）
- **ディレクトリ**: ケバブ-case、複数形は避ける（`media-sidebar/` 而非 `media-sidebars/`）

## 完了条件

- [ ] server側の P0 ファイルが 200行以下に収まる
- [ ] tauri側の P0 ファイルが 200行以下に収まる
- [ ] route ファイルは 150行以下に収まる
- [ ] 各 hook/component に単一の責務が明確に記述できる
- [ ] `vp check` が通る
- [ ] `vp test` が通る
- [ ] 機能的な回帰がない（手動で主要フローを確認）
