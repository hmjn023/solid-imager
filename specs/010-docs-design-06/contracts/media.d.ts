import type { Media, NewMedia } from '~/infrastructure/db/schema';

/**
 * 指定されたIDのメディアを1件取得します。
 * @param id - 取得するメディアのUUID。
 * @returns - メディアオブジェクト。見つからない場合は undefined。
 */
export declare function selectMediaById(id: string): Promise<Media | undefined>;

/**
 * 新しいメディアをデータベースに挿入します。
 * @param data - 挿入するメディアのデータ。
 * @returns - 挿入されたメディアオブジェクト。
 */
export declare function insertMedia(data: NewMedia): Promise<Media>;

/**
 * 指定されたIDのメディア情報を更新します。
 * @param id - 更新するメディアのUUID。
 * @param data - 更新するデータ（部分的な更新も可能）。
 * @returns - 更新されたメディアオブジェクト。
 */
export declare function updateMedia(id: string, data: Partial<NewMedia>): Promise<Media>;

/**
 * 指定されたIDのメディアを削除します。
 * @param id - 削除するメディアのUUID。
 */
export declare function deleteMedia(id: string): Promise<void>;

/**
 * 指定された検索条件に一致するメディアを検索します。
 * @param options - 検索条件（タグ、ファイル名、日付範囲など）。
 * @returns - 条件に一致したメディアの配列。
 */
export declare function searchMedia(options: { tags?: string[]; filename?: string; dateRange?: { from?: Date; to?: Date; }; }): Promise<Media[]>;
