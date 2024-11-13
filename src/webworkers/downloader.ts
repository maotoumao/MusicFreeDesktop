import * as Comlink from "comlink";
import fs from "fs";
import fsPromises from "fs/promises";
import { Readable } from "stream";
import { encodeUrlHeaders } from "@/common/normalize-util";
import throttle from "lodash.throttle";
import { DownloadState as DownloadState } from "@/common/constant";
import { rimraf } from "rimraf";

async function cleanFile(filePath: string) {
  try {
    if ((await fsPromises.stat(filePath)).isFile()) {
      await rimraf(filePath);
    }
    return true;
  } catch {
    return false;
  }
}

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
  onStateChange: IOnStateChangeFunc,
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

    stm.on("error", () => {
      // 清理文件
      cleanFile(filePath);
    });
  } catch (e) {
    state = DownloadState.ERROR;
    onStateChange({
      state,
      msg: e?.message,
    });
    cleanFile(filePath);
  }
}


interface IOptions {
  onProgress?: (progress: ICommon.IDownloadFileSize) => Promise<void>;
  onEnded?: () => Promise<void>;
  onError?: (reason: Error) => Promise<void>;
}
async function downloadFileNew(
    mediaSource: IMusic.IMusicSource,
    filePath: string,
    options?: IOptions
) {
  let hasError = false;
  const {onProgress: onProgressCallback, onEnded: onEndedCallback, onError: onErrorCallback} = options ?? {};
  try {
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      hasError = true;
      onErrorCallback?.(new Error("Filepath is a directory"));
      return;
    }
  } catch (e) {
    // pass
  }

  const headers: Record<string, string> = {
    ...(mediaSource.headers ?? {}),
    "user-agent": mediaSource.userAgent,
  };

  try {
    const urlObj = new URL(mediaSource.url);
    let res: Response;
    if (urlObj.username && urlObj.password) {
      headers["Authorization"] = `Basic ${btoa(
          `${decodeURIComponent(urlObj.username)}:${decodeURIComponent(
              urlObj.password
          )}`
      )}`;
      urlObj.username = "";
      urlObj.password = "";
      res = await fetch(urlObj.toString(), {
        headers: headers,
      });
    } else {
      res = await fetch(encodeUrlHeaders(mediaSource.url, headers));
    }

    const totalSize = +res.headers.get("content-length");
    onProgressCallback?.({
      currentSize: 0,
      totalSize: totalSize
    })


    const stm = responseToReadable(res, {
      onRead(size) {
        if (hasError) {
          // todo abort
          return;
        }
        onProgressCallback?.({
          currentSize: size,
          totalSize: totalSize
        })
      },
      onError: (e) => {
        if (!hasError) {
          hasError = true;
          onErrorCallback?.(e);
        }
      },
    }).pipe(fs.createWriteStream(filePath));

    stm.on("close", () => {
      onEndedCallback?.();
    });

    stm.on("error", (e) => {
      if (!hasError) {
        hasError = true;
        onErrorCallback?.(e);
      }
      // 清理文件
      cleanFile(filePath);
    });
  } catch (e) {
    if (!hasError) {
      hasError = true;
      onErrorCallback?.(e);
    }
    cleanFile(filePath);
  }
}



Comlink.expose({
  downloadFile,
  downloadFileNew
});
