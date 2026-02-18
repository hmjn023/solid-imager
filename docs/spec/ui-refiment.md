# UIの整理と改善

## 1. グローバル検索画面 (search.tsx) の改善
- **無限スクロールの導入**:
    - 現在のページネーション（「前へ」「次へ」ボタン）を廃止し、createInfiniteQuery を用いた無限スクロールに変更する。
    - IntersectionObserver を利用した自動読み込みを実装する。
    - **参照実装**: `sources/[mediaSourceId]/index.tsx` に既存の `createInfiniteQuery` + `IntersectionObserver` 実装があるため、これをベースとする。ロジックの共通化として `useInfiniteMediaQuery` カスタムフックの抽出を検討する。
- **表示形式の変更**:
    - 現在の詳細カード表示から、ソース詳細画面と同様の「サムネイルグリッド表示」に変更する。
- **スクロール位置の復元**:
    - 検索結果一覧から詳細画面へ遷移し、戻った際に元のスクロール位置を維持するロジックを実装する。
    - **注意**: 無限スクロール化により、現在の `searchState.scrollY` + `window.scrollTo` 方式では正しく復元できない可能性がある。`@tanstack/solid-query` のキャッシュ保持（`gcTime` の調整）により、既に読み込み済みのページデータを保持した状態での復元を実現する。復元時は `createEffect` で全ページ分のデータが描画された後に `scrollTo` を実行する。

## 2. マネージャー画面 (manager.tsx) の改善
- **表示形式の変更**:
    - AI tagging jobのスキャン結果一覧に、現在グローバル検索画面で使用されている「詳細情報付きカードコンポーネント」を適用する。
- **レイアウトの拡張**:
    - スキャン結果一覧が max-w-xl の制約により左に寄っている問題を修正し、画面幅全体（container幅）を有効活用するようにグリッドレイアウトを調整する。
    - **影響範囲**: レイアウト修正は AI Tagging セクションのスキャン結果表示部分のみに限定する。エンティティ管理（Characters, IPs, Projects, Tags）の CRUD UI のレイアウトは変更しない。

## 3. 共通メディアコンポーネントの整理
- 以下の2種類のコンポーネントを定義し、各画面で再利用可能にする。
    - **MediaGridItem**: サムネイルのみの軽量表示（ソース詳細、新グローバル検索で使用）。
    - **MediaCardItem**: ファイル名、パス、サイズ、解像度等を含む詳細表示（マネージャー画面、AIスキャン結果で使用）。

## 4. 検索コントロールパネル (search-control-panel.tsx) の修正
- **プリセット解除ボタンの修正**:
    - プリセット解除ボタン（×ボタン）のアイコンが表示されていない問題を修正。
    - **原因調査**: アイコンが表示されない原因（UnoCSS safelist 漏れ、CSSクラス不一致、`i-lucide-x` クラスの未定義等）を先に特定し、原因に応じて修正する。`svg` タグへの置き換えは最終手段とする。
    - プリセットを解除した際に、現在の検索モード（詳細/簡易）が維持されず、強制的に簡易検索モードに戻ってしまう問題を修正する。
- **「検索」ボタンの削除**:
    - 検索サイドバーの一番下にある、リアルタイム反映のため不要となっている「検索」ボタンを削除する（`search-control-panel.tsx` L130-L132 の `検索 (詳細)` ボタン）。
- **詳細検索の挙動修正**:
    - 詳細検索モードでプリセットを外した際、簡易検索モードに切り替わらず詳細モードを維持するようにする。

---

## 実装詳細計画 (Technical Plan)

### 1. 共通コンポーネントの作成
既存のコードを整理し、`apps/server/src/components/media/` 配下に新規コンポーネントを作成します。

- **`media-grid-item.tsx`**
    - **役割**: サムネイル主体のグリッド表示用アイテム。
    - **Props**: `id`, `mediaSourceId`, `fileName`, `width`, `height` 等。
    - **実装**: `search.tsx` や `sources/[mediaSourceId]/index.tsx` のグリッドアイテムを移植・共通化。`A` タグでラップし、遷移可能にする。

- **`media-card-item.tsx`**
    - **役割**: 詳細情報付きのカード表示用アイテム。
    - **Props**: `id`, `mediaSourceId`, `fileName`, `filePath`, `fileSize`, `width`, `height`, `selectable` (選択モード用), `selected`, `onToggle`。
    - **実装**: `search.tsx` の現在のカード表示ロジックを移植。`manager.tsx` での使用を想定し、チェックボックス（`selectable`）のロジックを組み込む。

### 2. 無限スクロール共通化
- **`use-infinite-media-query.ts`** (新規フック、検討)
    - `sources/[mediaSourceId]/index.tsx` と `search.tsx` の両方で使用される `createInfiniteQuery` + `IntersectionObserver` のロジックを共通化する。
    - **引数**: `queryKey`, `queryFn`, `options`（`gcTime` 等）。
    - **戻り値**: `data` (フラット化済みメディア配列), `sentinelRef`, `isFetchingNextPage`, `hasNextPage`。
    - **注意**: 共通化の複雑度が高い場合は、まず `search.tsx` にインラインで実装し、後のリファクタリングで共通化する段階的アプローチも可。

### 3. ファイル別修正方針

#### `apps/server/src/routes/search.tsx`
- **データ取得**:
    - `createQuery` を `createInfiniteQuery` に変更。
    - `offset` 管理を `pageParam` に移行。
    - `handleNextPage` / `handlePrevPage` を削除。
- **UI変更**:
    - 既存のカードグリッド (L283-L337) を `MediaGridItem` のグリッド（`grid-cols-2 md:grid-cols-3...`）に置き換え。
    - ページネーションボタン (L260-L281) を削除し、下部に `IntersectionObserver` 用のローディング要素（sentinel）を配置。
- **スクロール復元**:
    - `gcTime` を十分に長く設定し、ページ遷移後もキャッシュを保持。
    - 全ページデータの描画完了後に `window.scrollTo(0, searchState.scrollY)` を実行。

#### `apps/server/src/routes/manager.tsx`
- **AI Tagging UI**:
    - `scannedMedia` の表示ループ内で、インラインのカード実装を `MediaCardItem` に置き換え。
    - `selectable={true}` を渡し、選択状態の管理を連携。
- **レイアウト**:
    - AI Tagging セクションの親コンテナの `max-w-xl` クラスを削除し、グリッドのカラム数を画面幅に応じてレスポンシブに調整（例: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`）。
    - エンティティ管理 UI のレイアウトには変更を加えない。

#### `apps/server/src/components/media/preset-manager.tsx`
- **プリセット解除ロジック**:
    - `handleClearSelection` を修正。`resetSearchState()` を使わず、プリセット解除専用の `clearPresetFilters()` 関数を `search-store.ts` に新設する。
    - `clearPresetFilters()` はフィルター値（`keyword`, `tags`, `advancedCondition` 等）のみをリセットし、`mode`, `selectedSource`, `tagMode`, `sortBy`, `sortOrder` は現在の値を維持する。
- **アイコン修正**:
    - 先にアイコン非表示の原因を特定（UnoCSS safelist / アイコンプリセット設定を確認）。原因に応じた最小限の修正を実施。

#### `apps/server/src/presentation/store/search-store.ts`
- **`clearPresetFilters` 関数の追加**:
    - フィルター関連のステートのみをリセットする関数を新設。
    - `mode`, `selectedSource`, `tagMode`, `sortBy`, `sortOrder` を保持したまま、検索条件のみクリアする。

#### `apps/server/src/components/media/search-control-panel.tsx`
- **不要ボタン削除**:
    - モバイル/PC両方のビューから、最下部の「検索」ボタンを削除（自動反映されるため）。
    - 対象箇所: L130-L132 の `<Button class="w-full" onClick={props.onSearch} type="button">検索 (詳細)</Button>`。
