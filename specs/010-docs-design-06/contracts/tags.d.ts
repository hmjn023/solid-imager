import type {
  Tag,
  NewTag,
  MediaTag,
  NewMediaTag,
} from "~/infrastructure/db/schema";

/**
 * すべてのタグを取得します。
 * @returns - タグの配列。
 */
export declare function selectAllTags(): Promise<Tag[]>;

/**
 * 新しいタグをデータベースに挿入します。
 * @param data - 挿入するタグのデータ。
 * @returns - 挿入されたタグオブジェクト。
 */
export declare function insertTag(data: NewTag): Promise<Tag>;

/**
 * 指定されたIDのタグを更新します。
 * @param id - 更新するタグのID。
 * @param data - 更新するデータ。
 * @returns - 更新されたタグオブジェクト。
 */
export declare function updateTag(
  id: number,
  data: Partial<NewTag>
): Promise<Tag>;

/**
 * 指定されたIDのタグを削除します。
 * @param id - 削除するタグのID。
 */
export declare function deleteTag(id: number): Promise<void>;

/**
 * 指定されたメディアにタグを関連付けます。
 * @param data - 関連付けるメディアIDとタグID。
 * @returns - 作成された中間テーブルのレコード。
 */
export declare function insertMediaTag(data: NewMediaTag): Promise<MediaTag>;

/**
 * 指定されたメディアからタグの関連付けを解除します。
 * @param mediaId - メディアのUUID。
 * @param tagId - タグのID。
 */
export declare function deleteMediaTag(
  mediaId: string,
  tagId: number
): Promise<void>;
