import { DownloadState } from "@/common/constant";
import Store from "@/common/store";

export const downloadingQueueStore = new Store<
  Array<
    [
      IMusic.IMusicItem,
      {
        state: DownloadState;
        downloaded?: number;
        total?: number;
        msg?: string;
      }
    ]
  >
>([]);
