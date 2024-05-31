import { safeParse, safeStringify } from "@/common/safe-serialization";
import database from "../db";

const queryMetaSql = database.prepare<
  [string, string, string],
  { meta: string }
>(`
    SELECT meta FROM "main"."mediaMeta" 
    WHERE platform=? AND id=? AND type=?
`);

const updateMetaSql = database.prepare<[string, string, string, string], void>(`
    INSERT INTO "main"."mediaMeta" (platform, id, type, meta) 
    VALUES (?, ?, ?, ?)
    ON CONFLICT(platform, id, type) 
    DO UPDATE 
        SET meta=excluded.meta
`);
function getMediaMeta(
  mediaItem: IMedia.IMediaBase,
  type: IMedia.SupportMediaType = "music"
) {
  try {
    const raw = queryMetaSql.get(mediaItem.platform, mediaItem.id, type);
    if (raw) {
      return safeParse(raw?.meta);
    }
    return null;
  } catch {
    return null;
  }
}

function setMediaMeta(
  mediaItem: IMedia.IMediaBase,
  meta: any,
  type: IMedia.SupportMediaType = "music"
) {
  const metaStr = safeStringify(meta);
  try {
    updateMetaSql.run(mediaItem.platform, mediaItem.id, type, metaStr);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export default {
  getMediaMeta,
  setMediaMeta,
};
