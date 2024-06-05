import EventEmitter from "eventemitter3";

export const ee = new EventEmitter();

export enum DownloadEvts {
  DownloadStatusUpdated = "DownloadStatusUpdated",
  Downloaded = "Downloaded",
  RemoveDownload = "RemoveDownload",
}
