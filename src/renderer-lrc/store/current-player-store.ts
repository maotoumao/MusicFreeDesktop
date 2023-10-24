import Store from "@/common/store";
import { PlayerState, RepeatMode } from "@/renderer/core/track-player/enum";

interface IExtData {
  music: IMusic.IMusicItem | null;
  lyric: ILyric.IParsedLrcItem[];
  playerState: PlayerState;
  repeatMode: RepeatMode;
}

export default new Store<Partial<IExtData>>({});
