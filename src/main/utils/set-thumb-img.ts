import { asyncCacheFn } from "@/common/cache-fn";
import axios from "axios";
import fs from "fs/promises";
import getResourcePath from "@/utils/main/get-resource-path";

const getDefaultAlbumBuffer = asyncCacheFn(async () => {
  return await fs.readFile(getResourcePath("album-cover.jpeg"));
});

let hasHooked = false;

export default async function (src: string, hwnd: bigint) {
  try {
    const TaskbarThumbnailManager = (
      await import(
        "@native/TaskbarThumbnailManager/TaskbarThumbnailManager.node"
      )
    ).default;
    if (!hasHooked) {
      TaskbarThumbnailManager.config(hwnd);
      hasHooked = true;
    }
    let buffer: Buffer;
    if (!src) {
      buffer = await getDefaultAlbumBuffer();
    } else if (src.startsWith("http")) {
      try {
        buffer = (
          await axios.get(src, {
            responseType: "arraybuffer",
          })
        ).data;
      } catch {
        buffer = await getDefaultAlbumBuffer();
      }
    } else if (src.startsWith("data:image")) {
      buffer = Buffer.from(src.split(";base64,").pop(), "base64");
    } else {
      buffer = await getDefaultAlbumBuffer();
    }

    const size = 106;

    const sharp = (await import("sharp")).default;
    const result = await sharp(buffer)
      .resize(size, size, {
        fit: "cover",
      })
      .png()
      .ensureAlpha(1)
      .raw()
      .toBuffer({
        resolveWithObject: true,
      });

    TaskbarThumbnailManager.sendIconicRepresentation(
      hwnd,
      {
        width: size,
        height: size,
      },
      result.data
    );
  } catch {
    console.error("Not Support");
  }
}
