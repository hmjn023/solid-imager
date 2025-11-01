# クイックスタートガイド: DB操作関数

このガイドでは、新しく実装されるDB操作関数の基本的な使用方法について説明します。

## 1. 関数のインポート

すべてのDB操作関数は、`~/infrastructure/db/queries` ディレクトリ内の各ドメインファイルからエクスポートされます。将来的には `~/infrastructure/db/queries/index.ts` からまとめてインポートできるようになります。

**例: `media` と `tags` の関数をインポートする**
```typescript
import {
  selectMediaById,
  insertMedia,
} from '~/infrastructure/db/queries/media';

import {
  selectAllTags,
  insertTag,
} from '~/infrastructure/db/queries/tags';
```

## 2. 関数の利用

インポートした関数は、アプリケーションのサービスレイヤーなどで非同期に呼び出すことができます。
関数は型安全であり、`schema.ts` で定義された `Select` 型および `Insert` 型に基づいた引数を期待します。

**例: 新しいメディアを作成し、タグを付与するサービス**
```typescript
import type { NewMedia } from '~/infrastructure/db/schema';
import { insertMedia } from '~/infrastructure/db/queries/media';
import { insertTag, insertMediaTag } from '~/infrastructure/db/queries/tags';

async function createNewMediaWithTags(mediaData: NewMedia, tagNames: string[]) {
  // 1. 新しいメディアをDBに挿入
  const newMedia = await insertMedia(mediaData);
  console.log(`メディアが作成されました: ${newMedia.id}`);

  // 2. タグを作成し、メディアに関連付ける
  for (const name of tagNames) {
    const newTag = await insertTag({ name });
    await insertMediaTag({
      mediaId: newMedia.id,
      tagId: newTag.id,
    });
    console.log(`タグ '${name}' がメディアに関連付けられました。`);
  }

  return newMedia;
}
```

## 3. エラーハンドリング

各DB操作関数は、データベース操作中にエラーが発生した場合、例外をスローします。これらの関数を呼び出す際は、`try...catch` ブロックを使用して適切にエラーを処理してください。

```typescript
try {
  const media = await selectMediaById('some-invalid-uuid');
} catch (error) {
  console.error("データベース操作に失敗しました:", error);
  // ユーザーへのエラー通知などの処理
}
```
