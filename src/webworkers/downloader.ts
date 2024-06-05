import * as Comlink from "comlink";
import fs from "fs";
import { Readable } from "stream";
import { encodeUrlHeaders } from "@/common/normalize-util";
import throttle from "lodash.throttle";
import { DownloadState as DownloadState } from "@/common/constant";

const responseToReadable = (
  response: Response,
  options?: {
    onRead?: (size: number) => void;
    onDone?: () => void;
    onError?: (e: Error) => void;
  }
) => {
  const reader = response.body.getReader();
  const rs = new Readable();
  let size = 0;
  const tOnRead = throttle(options?.onRead, 64, {
    leading: true,
    trailing: true,
  });
  rs._read = async () => {
    const result = await reader.read();
    if (!result.done) {
      rs.push(Buffer.from(result.value));
      size += result.value.byteLength;
      tOnRead?.(size);
    } else {
      rs.push(null);
      options?.onDone?.();
      return;
    }
  };
  rs.on("error", options?.onError);
  return rs;
};

type IOnStateChangeFunc = (data: {
  state: DownloadState;
  downloaded?: number;
  total?: number;
  msg?: string;
}) => void;

async function downloadFile(
  mediaSource: IMusic.IMusicSource,
  filePath: string,
  onStateChange: IOnStateChangeFunc
  // onProgress?: (progress: ICommon.IDownloadFileSize) => Promise<void>,
  // onDone?: () => void,
  // onError?: (reason: Error) => Promise<void>
) {
  let state = DownloadState.DOWNLOADING;
  try {
    const stat = fs.statSync(filePath);
    // if (stat.isFile()) {
    //   state = DownloadState.ERROR;
    //   onStateChange?.({
    //     state,
    //     msg: "File Exist",
    //   });
    //   return;
    // }
    if (stat.isDirectory()) {
      state = DownloadState.ERROR;
      onStateChange?.({
        state,
        msg: "Filepath is a directory",
      });
      return;
    }
  } catch (e) {}
  const _headers: Record<string, string> = {
    ...(mediaSource.headers ?? {}),
    "user-agent": mediaSource.userAgent,
  };

  try {
    const urlObj = new URL(mediaSource.url);
    let res: Response;
    if (urlObj.username && urlObj.password) {
      _headers["Authorization"] = `Basic ${btoa(
        `${decodeURIComponent(urlObj.username)}:${decodeURIComponent(
          urlObj.password
        )}`
      )}`;
      urlObj.username = "";
      urlObj.password = "";
      res = await fetch(urlObj.toString(), {
        headers: _headers,
      });
    } else {
      res = await fetch(encodeUrlHeaders(mediaSource.url, _headers));
    }

    const totalSize = +res.headers.get("content-length");
    onStateChange({
      state,
      downloaded: 0,
      total: totalSize,
    });
    const stm = responseToReadable(res, {
      onRead(size) {
        if (state !== DownloadState.DOWNLOADING) {
          return;
        }
        state = DownloadState.DOWNLOADING;
        console.log(state, size, totalSize);
        onStateChange({
          state,
          downloaded: size,
          total: totalSize,
        });
      },
      onError: (e) => {
        state = DownloadState.ERROR;
        onStateChange({
          state,
          msg: e?.message,
        });
      },
    }).pipe(fs.createWriteStream(filePath));

    stm.on("close", () => {
      state = DownloadState.DONE;
      onStateChange({
        state,
      });
    });
  } catch (e) {
    state = DownloadState.ERROR;
    onStateChange({
      state,
      msg: e?.message,
    });
  }
}

Comlink.expose({
  downloadFile,
});
