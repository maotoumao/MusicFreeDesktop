import Dexie, { Table } from "dexie";
import { useEffect, useState } from "react";

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

export function useUserPerference<K extends keyof IUserPerference.IType>(
  key: K
) {
  const [state, _setState] = useState(getUserPerference(key));

  function setState(newState: IUserPerference.IType[K] | null) {
    _setState(newState);
    setUserPerference(key, newState);
  }

  return [state, setState] as const;
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

const dbKeyUpdateCbs = new Map<
  keyof IUserPerference.IDBType,
  Set<(...args: any) => void>
>();

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
    const cb = dbKeyUpdateCbs.get(key);
    cb?.forEach((it) => it?.(value));
    return true;
  } catch {
    return false;
  }
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

export function useUserPerferenceIDBValue<K extends keyof IUserPerference.IDBType>(
  key: K
) {
  const [state, setState] = useState<IUserPerference.IDBType[K] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await getUserPerferenceIDB(key);
        setState(result);
      } catch {
      } finally {
        if (dbKeyUpdateCbs.has(key)) {
          dbKeyUpdateCbs.get(key).add(setState);
        } else {
          dbKeyUpdateCbs.set(key, new Set([setState]));
        }
      }
    })();
  }, []);

  return state;
}
