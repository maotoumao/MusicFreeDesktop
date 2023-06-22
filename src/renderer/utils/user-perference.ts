import Dexie, { Table } from "dexie";

const basicType = ["number", "string", "boolean", "null", "undefined"];

export function setUserPerference<K extends keyof IUserPerference.IType>(
  key: K,
  value: IUserPerference.IType[K]
) {
  try {
    if (typeof value in basicType) {
      localStorage.setItem(key, value as any);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // 设置失败
  }
}

export function removeUserPerference(key: keyof IUserPerference.IType) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function getUserPerference<K extends keyof IUserPerference.IType>(
  key: K
): IUserPerference.IType[K] | null {
  let rawData = null;
  try {
    rawData = localStorage.getItem(key);
    if (!rawData) {
      return null;
    }
    return JSON.parse(rawData);
  } catch {
    return rawData as any;
  }
}


/** 比较大的数据 */

class UserPerferenceDB extends Dexie {
  // 歌单信息，其中musiclist只存有platform和id
  perference: Table<Record<string, any>>;

  constructor() {
    super("userPerferenceDB");
    this.version(1.0).stores({
      perference: "&key",
    });
  }
}

const upDB = new UserPerferenceDB();

export async function setUserPerferenceIDB<
  K extends keyof IUserPerference.IDBType
>(key: K, value: IUserPerference.IDBType[K]) {
  try {
    await upDB.transaction("readwrite", upDB.perference, async () => {
      await upDB.perference.put({
        key,
        value,
      });
    });
  } catch {}
}

export async function getUserPerferenceIDB<
  K extends keyof IUserPerference.IDBType
>(key: K): Promise<IUserPerference.IDBType[K] | null> {
  try {
    return (
      (
        await upDB.transaction("readonly", upDB.perference, async () => {
          return await upDB.perference.get(key);
        })
      )?.value ?? null
    );
  } catch {
    return null;
  }
}
