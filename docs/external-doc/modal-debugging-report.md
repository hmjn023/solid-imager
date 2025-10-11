# SolidJSモーダル問題の原因と解決方法

## 問題の概要
- ボタンを押してもモーダルが開かない
- JavaScript自体が動作していない状態
- コンソールにログも表示されない

## 原因の特定プロセス

### 1. 基本的なJavaScript動作確認
```tsx
// 最初のテスト - シンプルなボタン
<button onClick={() => console.log("Button clicked!")}>
  Test Button
</button>
```
→ **反応なし** = JavaScript/Hydrationの問題

### 2. 段階的デバッグ
```tsx
// 最もシンプルな形から開始
export default function Sources() {
  return (
    <button onClick={() => alert("Button works!")}>
      Click Me
    </button>
  );
}
```
→ **動作した** = 複雑なコンポーネント構造が原因

### 3. 段階的機能追加
```tsx
// Step 1: シグナル追加
const [showModal, setShowModal] = createSignal(false);

// Step 2: Portal追加
<Portal>
  {showModal() && <div>Modal content</div>}
</Portal>

// Step 3: フォーム状態管理
const [formName, setFormName] = createSignal("");
```

## 主な原因

### 1. 複雑なコンポーネントの依存関係
- `SourceFormModal` や `SourceDeleteModal` 内部の複雑な構造
- UIライブラリの `Dialog`, `AlertDialog` コンポーネントの問題
- インポートチェーンでの循環参照や未解決の依存関係

### 2. clientOnly の不適切な使用
```tsx
// 問題のあったコード
const SourceFormModal = clientOnly(() => import("~/components/source-form-modal"));
```
- コンポーネント内部に問題があるため `clientOnly` でも解決しなかった
- 複雑なコンポーネントチェーンでSSR/CSRの境界が曖昧

### 3. Hydration の問題
- サーバーサイドでレンダリングされたHTMLとクライアントサイドのJavaScriptが同期していない
- 複雑なコンポーネント構造でイベントハンドラーが正常にアタッチされない

## 解決方法

### 1. シンプルなコンポーネントから構築
```tsx
// 基本的なHTML要素から開始
<button onClick={handleClick}>Add Source</button>

// 段階的にSolidJS機能を追加
const [showModal, setShowModal] = createSignal(false);

// Portal を使用したモーダル実装
<Portal>
  {showModal() && (
    <div class="fixed inset-0 bg-black bg-opacity-50">
      <div class="bg-white p-6 rounded-lg">
        {/* モーダル内容 */}
      </div>
    </div>
  )}
</Portal>
```

### 2. 段階的デバッグアプローチ
1. **JavaScript動作確認** - `alert()` や `console.log()`
2. **シグナル動作確認** - 状態変更の表示
3. **Portal動作確認** - 基本的なモーダル表示
4. **フォーム動作確認** - 入力状態管理
5. **API統合** - 実際のデータ処理

### 3. 問題の早期発見
- 複雑なコンポーネントを避け、基本的なDOM要素から開始
- 段階的に機能を追加し、各段階で動作確認
- 問題が発生した段階で原因を特定

## 最終的な動作コード

```tsx
import { createSignal } from "solid-js";
import { Portal } from "solid-js/web";

export default function Sources() {
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [formName, setFormName] = createSignal("");
  const [formPath, setFormPath] = createSignal("");

  const handleAddSource = () => {
    setShowAddModal(true);
  };

  return (
    <div class="container mx-auto p-6">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-3xl font-bold">Media Sources</h1>
        <button
          onClick={handleAddSource}
          type="button"
          class="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Add Source
        </button>
      </div>

      <Portal>
        {showAddModal() && (
          <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
              <h2 class="text-xl font-bold mb-4">Add Media Source</h2>
              <div class="space-y-4 mb-4">
                <div>
                  <label class="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    placeholder="Enter source name"
                    value={formName()}
                    onInput={(e) => setFormName(e.currentTarget.value)}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Path</label>
                  <input
                    type="text"
                    placeholder="Enter file path"
                    value={formPath()}
                    onInput={(e) => setFormPath(e.currentTarget.value)}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div class="flex gap-2">
                <button
                  onClick={() => {
                    console.log("Save clicked with data:", {
                      name: formName(),
                      path: formPath(),
                      type: "local",
                      connectionInfo: { path: formPath() }
                    });
                    setFormName("");
                    setFormPath("");
                    setShowAddModal(false);
                  }}
                  class="px-4 py-2 bg-blue-500 text-white rounded"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  class="px-4 py-2 bg-gray-500 text-white rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </Portal>
    </div>
  );
}
```

## 教訓

1. **複雑さを避ける** - 最初からUIライブラリの複雑なコンポーネントを使用しない
2. **段階的構築** - シンプルなものから始めて徐々に機能を追加
3. **早期デバッグ** - 各段階で動作確認を行う
4. **基本に戻る** - 問題が発生したら基本的なHTML要素から確認

SolidStartでは、SSRとCSRの境界や複雑なコンポーネントの依存関係に注意が必要です。