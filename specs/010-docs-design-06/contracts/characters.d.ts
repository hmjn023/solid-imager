import type { Character, NewCharacter, MediaCharacter, NewMediaCharacter } from '~/infrastructure/db/schema';

/**
 * すべてのキャラクターを取得します。
 * @returns - キャラクターの配列。
 */
export declare function selectAllCharacters(): Promise<Character[]>;

/**
 * 新しいキャラクターをデータベースに挿入します。
 * @param data - 挿入するキャラクターのデータ。
 * @returns - 挿入されたキャラクターオブジェクト。
 */
export declare function insertCharacter(data: NewCharacter): Promise<Character>;

/**
 * 指定されたIDのキャラクターを更新します。
 * @param id - 更新するキャラクターのID。
 * @param data - 更新するデータ。
 * @returns - 更新されたキャラクターオブジェクト。
 */
export declare function updateCharacter(id: number, data: Partial<NewCharacter>): Promise<Character>;

/**
 * 指定されたIDのキャラクターを削除します。
 * @param id - 削除するキャラクターのID。
 */
export declare function deleteCharacter(id: number): Promise<void>;

/**
 * 指定されたメディアにキャラクターを関連付けます。
 * @param data - 関連付けるメディアIDとキャラクターID。
 * @returns - 作成された中間テーブルのレコード。
 */
export declare function insertMediaCharacter(data: NewMediaCharacter): Promise<MediaCharacter>;

/**
 * 指定されたメディアからキャラクターの関連付けを解除します。
 * @param mediaId - メディアのUUID。
 * @param characterId - キャラクターのID。
 */
export declare function deleteMediaCharacter(mediaId: string, characterId: number): Promise<void>;
