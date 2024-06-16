import { safeParse } from "@/common/safe-serialization";
import Dexie, { Table } from "dexie";
import EventEmitter from "eventemitter3";
import { useEffect, useState } from "react";

const basicType = ["number", "string", "boolean", "null", "undefined"];

const ee = new EventEmitter();

enum EvtNames {
  USER_PREFERENCE_UPDATE = "USER_PREFERENCE_UPDATE",
}

export function setUserPreference<K extends keyof IUserPreference.IType>(
  key: K,
  value: IUserPreference.IType[K]
) {
  try {
    let newValue;
    if (typeof value in basicType) {
      newValue = value as any;
    } else {
      newValue = JSON.stringify(value);
    }
    localStorage.setItem(key, newValue as any);
    ee.emit(EvtNames.USER_PREFERENCE_UPDATE, key, value);
  } catch {
    // 设置失败
  }
}

export function removeUserPreference(key: keyof IUserPreference.IType) {
  try {
    localStorage.removeItem(key);
    ee.emit(EvtNames.USER_PREFERENCE_UPDATE, key, null);
  } catch {}
}

export function getUserPreference<K extends keyof IUserPreference.IType>(
  key: K
): IUserPreference.IType[K] | null {
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

export function useUserPreference<K extends keyof IUserPreference.IType>(
  key: K
) {
  const [state, _setState] = useState(getUserPreference(key));

  function setState(newState: IUserPreference.IType[K] | null) {
    setUserPreference(key, newState);
  }

  useEffect(() => {
    const updateFn = (updateKey: K, value: IUserPreference.IType[K] | null) => {
      if (key === updateKey) {
        _setState(value);
      }
    };

    const updateFnStorage = (e: StorageEvent) => {
      if (e.key === key) {
        try {
          _setState(JSON.parse(e.newValue));
        } catch {
          _setState(e.newValue as any);
        }
      }
    };

    ee.on(EvtNames.USER_PREFERENCE_UPDATE, updateFn);
    window.addEventListener("storage", updateFnStorage);

    return () => {
      ee.off(EvtNames.USER_PREFERENCE_UPDATE, updateFn);
      window.removeEventListener("storage", updateFnStorage);
    };
  }, []);

  return [state, setState] as const;
}

/** 比较大的数据 */

class UserPreferenceDB extends Dexie {
  // 歌单信息，其中musiclist只存有platform和id
  perference: Table<Record<string, any>>;

  constructor() {
    super("userPerferenceDB");
    this.version(1.0).stores({
      perference: "&key",
    });
  }
}

const upDB = new UserPreferenceDB();

const dbKeyUpdateCbs = new Map<
  keyof IUserPreference.IDBType,
  Set<(...args: any) => void>
>();

export async function setUserPreferenceIDB<
  K extends keyof IUserPreference.IDBType
>(key: K, value: IUserPreference.IDBType[K]) {
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

export async function getUserPreferenceIDB<
  K extends keyof IUserPreference.IDBType
>(key: K): Promise<IUserPreference.IDBType[K] | null> {
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

export function useUserPreferenceIDBValue<
  K extends keyof IUserPreference.IDBType
>(key: K) {
  const [state, setState] = useState<IUserPreference.IDBType[K] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await getUserPreferenceIDB(key);
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
