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

### 4.1. コンポーネント設計

#### 4.1.1. 設計方針
**Composition Pattern** を採用し、コンポーネントの柔軟な組み合わせを可能にする。`SearchControlPanel` は薄いラッパーとし、既存コンポーネントを内部で組み合わせる形とする。

```
SearchControlPanel
├── 検索モード切替 (簡易/詳細)
├── SearchFilters または ProSearchBuilder (モードに応じて表示)
├── SortControls
└── PresetManager
```

#### 4.1.2. コンポーネント構成
`apps/server/src/components/media/` 配下に共通パネルを作成する。

```typescript
// SearchControlPanel.tsx の構成イメージ
interface SearchControlPanelProps {
  // 検索コンテキスト
  context: "source" | "global";
  // 検索実行時のコールバック
  onSearch: () => void;
  // フィルター用データ（外部から注入）
  filterData: {
    tags: TagResponse[] | undefined;
    projects: Project[] | undefined;
    ips: Ip[] | undefined;
    characters: Character[] | undefined;
    authors: Author[] | undefined;
  };
  // オプション: ソースセレクターを表示するか（全体検索のみ）
  showSourceSelector?: boolean;
}

export function SearchControlPanel(props: SearchControlPanelProps) {
  return (
    <div class="space-y-4">
      {/* 検索モード切替ボタン */}
      <SearchModeToggle />
      
      {/* 簡易/詳細検索 */}
      <Show when={searchState.mode === "simple"} fallback={<ProSearchBuilder {...} />}>
        <SearchFilters {...} />
      </Show>
      
      {/* ソート制御 */}
      <SortControls />
      
      {/* プリセット管理 */}
      <PresetManager />
    </div>
  );
}
```

#### 4.1.3. Context Providerの検討
`context: "source" | "global"` による分岐が複雑になる場合は、将来的に `SearchContext` を導入し、検索コンテキストを Provider 経由で提供することを検討する。現時点では props による制御で十分と判断。

### 4.2. 永続化ロジックの共通化

#### 4.2.1. 現状の実装
現在の `useCurrentSearchPersistence.ts` は `CURRENT_PRESET_NAME = "current"` をハードコードしている（12行目）。

#### 4.2.2. 変更方針
```typescript
// 予約プリセット名の定義
export const RESERVED_PRESET_NAMES = ["current", "current-all"] as const;
export type ReservedPresetName = (typeof RESERVED_PRESET_NAMES)[number];

export function useCurrentSearchPersistence(
  presetName: ReservedPresetName = "current"
) {
  // presetName をキーとして取得・保存を行う
  // 全体検索ページでは "current-all" を渡す
}
```

### 4.3. ストア状態管理

#### 4.3.1. 問題と対策
`search-store.ts` はグローバルな状態を保持しているため、全体検索とソース別検索を行き来すると状態が混ざる可能性がある。

**対策:**
1. **マウント時のDB読み込み**: `useCurrentSearchPersistence` がマウント時に該当プリセット名でDBから最新状態を読み込み、ストアを上書きする。これにより、ページ遷移時に適切なコンテキストの状態が復元される。

2. **ソースID引き継ぎ**: 全体検索ページからソース別検索ページに遷移した際は、遷移先のソースIDを `searchState.selectedSource` にセットし、検索条件はクリアまたは維持（ユーザー設定に応じる）。

3. **明示的なリセット不要**: 現行の設計では、各ページが `useCurrentSearchPersistence` を呼び出す際に適切なプリセット名を指定することで、状態の分離が実現される。

### 4.4. 入力補完の実装

#### 4.4.1. 既存APIの活用
入力補完には、既存の一覧取得APIを活用する。新規APIは不要。

| 項目 | 既存エンドポイント | 実装ファイル |
|------|-------------------|--------------|
| タグ | `GET /api/tags` | `fetchTags()` |
| キャラクター | `GET /api/charactors` | `fetchAllCharacters()` |
| IP | `GET /api/ips` | `fetchAllIps()` |
| 作者 | `GET /api/authors` | `fetchAllAuthors()` |
| プロジェクト | `GET /api/projects` | `fetchAllProjects()` |

#### 4.4.2. クライアントサイドフィルタリング
現時点では候補データ量が限定的であるため、クライアントサイドでフィルタリングを行う。

```typescript
// 入力補完の実装例（Combobox使用）
const filteredTags = createMemo(() => {
  const query = inputValue().toLowerCase();
  return tags()?.filter(tag => 
    tag.name.toLowerCase().includes(query)
  ) ?? [];
});
```

#### 4.4.3. 将来のスケーラビリティ対応
大量データ（1万件以上）が発生した場合は、以下のサーバーサイド補完APIを追加検討する:

```
GET /api/autocomplete?field=tags&query=xxx&limit=20
```

現時点ではこのAPIの実装は不要。

## 5. 影響範囲

### 5.1. 変更対象ファイル

| ファイル | 変更内容 |
|----------|----------|
| `apps/server/src/components/media/SearchControlPanel.tsx` | **[NEW]** 共通検索パネルコンポーネント |
| `apps/server/src/routes/sources/[mediaSourceId]/index.tsx` | 共通コンポーネントへの置き換え |
| `apps/server/src/routes/search.tsx` | 共通コンポーネントの導入、詳細検索・プリセット・永続化対応 |
| `apps/server/src/hooks/use-current-search-persistence.ts` | プリセット名を引数化 |
| `apps/server/src/components/media/preset-manager.tsx` | `current-all` を予約名リストに追加（44行目のフィルタ条件を更新） |

### 5.2. 既存機能への影響
- ソース別検索ページの動作は変更なし（リファクタリングのみ）
- 既存のプリセットデータは影響を受けない

## 6. 保存領域の予約

### 6.1. 予約プリセット名
DBの `presets` テーブルにおいて、`name` カラムに以下の値を予約する。
- `current`: ソース検索用（既存）
- `current-all`: 全体検索用（新規）

### 6.2. UI上の挙動
`PresetManager` において、これらの予約名は一覧に表示せず、削除も不可とする。

**現状のコード（preset-manager.tsx:44行目）:**
```typescript
const presets = () => data()?.filter((p) => p.name !== "current");
```

**変更後:**
```typescript
const presets = () => data()?.filter((p) => 
  !RESERVED_PRESET_NAMES.includes(p.name as ReservedPresetName)
);
```

### 6.3. マイグレーション
**データベースマイグレーション: 不要**

`current-all` プリセットは、全体検索ページ初回アクセス時に `useCurrentSearchPersistence` によって自動生成される（既存の `current` と同様の挙動）。

## 7. テスト方針

### 7.1. ユニットテスト

#### 7.1.1. PresetService
既存テスト `apps/server/src/tests/unit/application/services/preset-service.test.ts` を拡張:
- 予約名 `current`, `current-all` が正しくフィルタリングされることを確認

**実行コマンド:**
```bash
bun --filter @solid-imager/server test tests/unit/application/services/preset-service.test.ts
```

### 7.2. 統合テスト

#### 7.2.1. 検索機能
既存テスト `apps/server/src/tests/integration/queries/search.test.ts` でカバー済み。

**実行コマンド:**
```bash
bun --filter @solid-imager/server test tests/integration/queries/search.test.ts
```

### 7.3. 手動テスト

#### 7.3.1. 全体検索ページの検証
1. `/search` にアクセス
2. 検索条件を入力し検索実行
3. ページをリロード
4. 検索条件が復元されていることを確認
5. プリセット保存・読込が正常に動作することを確認

#### 7.3.2. ソース別検索との状態分離確認
1. `/sources/{id}` でソース別検索を実行、条件A を設定
2. `/search` に遷移、条件B を設定
3. `/sources/{id}` に戻り、条件A が復元されていることを確認
4. `/search` に戻り、条件B が復元されていることを確認

### 7.4. Lint・型チェック

**実行コマンド:**
```bash
bun run lint
bun --filter @solid-imager/server check
```
