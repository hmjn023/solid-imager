# 要件・設計：全体検索機能の強化と検索コンポーネントの共通化

## 1. 背景
現在、各メディアソース詳細ページ（ソース別検索）では、簡易検索・詳細検索の切り替え、検索条件のプリセット保存、およびリロード時の検索状態復元機能が実装されている。
一方、全体検索ページ（`/search`）ではこれらの機能が一部未実装であり、また検索UIが重複して定義されているため、保守性とユーザー体験の両面で課題がある。

本設計では、検索UIを共通コンポーネント化し、全体検索ページにおいてもソース別検索と同等の高度な検索機能と永続化を提供することを目的とする。

## 2. 目的
- 検索入力UI（簡易・詳細・ソート・プリセット管理）の共通コンポーネント化。
- 全体検索ページへの詳細検索・プリセット・永続化機能の反映。
- リロード対策として、全体検索専用の予約プリセット名 `current-all` を用いた状態保存の実装。

## 3. 要件

### 3.1. 検索コンポーネントの共通化
- **SearchControlPanel (仮称)**:
    - 簡易検索（`SearchFilters`）と詳細検索（`ProSearchBuilder`/`ProSearchDialog`）を切り替えて表示できること。
    - ソート順・ソート項目（`SortControls`）を含めること。
    - プリセット管理（`PresetManager`）を含めること。
    - モバイル表示（Dialog内）とデスクトップ表示（Sidebar内）の両方に対応できる柔軟なレイアウトを持つこと。

### 3.2. 全体検索の強化
- 全体検索ページにおいても、詳細検索モードを利用可能にする。
- 検索条件の保存・読込（プリセット）を可能にする。
- メディアソースの選択状態も検索条件の一部として管理する。

### 3.3. 検索状態の永続化（リロード対策）
- `useCurrentSearchPersistence` フックを拡張し、以下の予約名でDBに自動保存・復元を行う。
    - ソース別検索ページ: `current`
    - 全体検索ページ: `current-all`
- ページ遷移時やリロード時に、それぞれのコンテキストに適した状態が復元されること。

### 3.4. 入力補完 (Autocomplete) の提供
- 簡易検索・詳細検索のいずれにおいても、以下の項目について入力補完を提供し、入力の正確性と利便性を向上させる。
    - タグ (Tags)
    - キャラクター (Characters)
    - IP
    - 作者 (Authors)
    - プロジェクト (Projects)
- 詳細検索（`ProSearchBuilder`）においては、`operator` が `equals` （と一致する）の場合に加え、`in` / `notIn` （いずれかを含む/含まない）の場合もカンマ区切り入力やタグ形式での入力を補助するための入力補完を提供することが望ましい。

## 4. 設計

### 4.1. コンポーネント構成
`apps/server/src/components/media/` 配下に共通パネルを作成する。

```typescript
// SearchControlPanel.tsx の構成イメージ
export function SearchControlPanel(props: {
  context: "source" | "global";
  onSearch: () => void;
  // フィルター用データ（tags, projects等）を共通で受け取るか、内部でQueryする
}) {
  // モード切り替え、ソート、フィルタUIを統合
}
```

### 4.2. 永続化ロジックの共通化
`useCurrentSearchPersistence.ts` を修正。

```typescript
export function useCurrentSearchPersistence(presetName: string = "current") {
  // presetName をキーとして取得・保存を行う
  // 全体検索ページでは "current-all" を渡す
}
```

### 4.3. ストアの調整
`search-store.ts` は現状グローバルな状態を保持している。
全体検索とソース別検索を頻繁に行き来する場合、状態が混ざる可能性があるため、以下の検討を行う：
- 原則として、`useCurrentSearchPersistence` がマウント時にDBから最新の状態を読み込むため、コンテキストに応じた上書きが行われる。
- 全体検索ページからソース別検索ページに遷移した際、ソースIDが自動でフィルタリング条件にセットされるようにする。

### 4.4. 入力補完の実装
- `SearchFilters` および `ProSearchBuilder` において、`Combobox` コンポーネントを活用して実装する。
- 全体検索ページにおいては、現在選択されているメディアソースに関わらず、システム全体から候補を取得・表示する。
- 候補データは `TanStack Query` を用いて非同期に取得し、コンポーネント間で共有可能にする。
- 大量のデータが存在する場合に備え、必要に応じてサーバーサイドでの絞り込み（Filtering）やキャッシュ戦略を検討する。

## 5. 影響範囲
- `apps/server/src/routes/sources/[mediaSourceId]/index.tsx`: 共通コンポーネントへの置き換え。
- `apps/server/src/routes/search.tsx`: 共通コンポーネントの導入と詳細検索対応。
- `apps/server/src/hooks/use-current-search-persistence.ts`: 引数対応。
- `apps/server/src/components/media/preset-manager.tsx`: `current-all` を予約名リストに追加。

## 6. 保存領域の予約
- DBの `presets` テーブルにおいて、`name` カラムに以下の値を予約する。
    - `current`: ソース検索用（既存）
    - `current-all`: 全体検索用（新規）
- UI（`PresetManager`）上では、これらの予約名は一覧に表示せず、削除も不可とする。
