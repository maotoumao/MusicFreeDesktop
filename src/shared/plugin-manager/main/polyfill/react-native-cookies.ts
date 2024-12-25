import {session} from "electron";

interface Cookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  version?: string;
  expires?: string;
  secure?: boolean;
  httpOnly?: boolean;
}

export interface Cookies {
  [key: string]: Cookie;
}

async function set(
  url: string,
  cookie: Cookie,
): Promise<boolean> {
    try {
        await session.defaultSession.cookies.set({
            url,
            ...cookie
        });
        return true;
    } catch {
        return false;
    }
}

async function get(url: string): Promise<Cookies> {
    try {
        const result = await session.defaultSession.cookies.get({
            url
        });
        const resultMap: Cookies = {};
        for(const r of result) {
            resultMap[r.name] = r;
        }
        return resultMap;
    } catch {
        return null;
    }
}

async function flush(): Promise<void> {
    return session.defaultSession.cookies.flushStore();
}

export default {
  set,
  get,
  flush,
};
