import { localPluginName } from "@/common/constant";

export default function isLocalMusic(mediaItem: IMedia.IMediaBase) {
  return mediaItem?.platform === localPluginName;
}
