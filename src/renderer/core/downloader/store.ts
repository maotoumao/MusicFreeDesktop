import { DownloadState } from "@/common/constant";
import Store from "@/common/store";

export type IDownloadingItem = [
  IMusic.IMusicItem,
  {
    state: DownloadState;
    downloaded?: number;
    total?: number;
    msg?: string;
  }
];

export const downloadingQueueStore = new Store<Array<IDownloadingItem>>([]);
