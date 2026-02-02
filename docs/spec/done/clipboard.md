# Clipboard

メディア個別表示ページで、各種タグや、メタデータから抽出したcomfyuiのworkflow,promptをコピーする機能を実装する。

## 前提条件・制約 (Secure Context)

Clipboard API (`navigator.clipboard`) を使用するため、本機能は **Secure Context** でのみ動作する。
- **動作環境**: `localhost` (127.0.0.1) または `HTTPS` 接続時。
- **非対応環境**: HTTP接続のLAN内アクセス（例: `http://192.168.x.x:3000`）などでは動作しない。
    - **エラーハンドリング**: 非対応環境でクリックされた場合は、ユーザーにコピー不可である旨をトースト等で通知する。

## UI/UX 設計

### コピーボタンの挙動
- **アイコン**: 通常時はコピーアイコン（`Copy`）を表示。
- **成功時フィードバック**:
    - クリック後、一時的（2秒程度）にチェックアイコン（`Check`）に変化させる。
    - 画面下部等に「クリップボードにコピーしました」というトースト通知を表示する。
- **失敗時フィードバック**:
    - コピーに失敗した場合（権限不足、非セキュア環境など）、エラー内容を含むトースト通知を表示する。

### 表示箇所

#### 1. タグ (Positive / Negative)
- **配置**: タグチップ（Badge）の内部、テキストの右横に控えめなサイズでコピーボタンを配置する。
- **対象**: タグの名称テキスト。

#### 2. Generation Info (Prompt / Workflow)
- **配置**: アコーディオン等の各セクション見出し（「Prompt」「Negative Prompt」「Workflow」）の右横に配置する。
- **対象**:
    - Prompt: テキスト全体。
    - Workflow: JSON文字列（整形済みかどうかは実装依存だが、基本は生JSONまたは整形JSON）。

## 実装詳細

### 共通コンポーネント (`ClipboardCopy`)
再利用可能なコピーボタンコンポーネントを作成する。

```typescript
type ClipboardCopyProps = {
  text: string;           // コピー対象のテキスト
  label?: string;         // アクセシビリティ用ラベル (aria-label)
  class?: string;         // 追加のスタイリング
  iconSize?: number;      // アイコンサイズ
};
```

### 依存ライブラリ
- アイコン: `lucide-solid` (既存プロジェクト準拠)
- 通知: `solid-toast` (既存プロジェクト準拠)