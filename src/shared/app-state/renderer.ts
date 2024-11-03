import {PlayerState, RepeatMode} from "@/common/constant";


interface IMod {
    syncCurrentMusic: (musicItem: IMusic.IMusicItem | null) => void;
    syncCurrentPlayerState: (playerState: PlayerState) => void;
    syncCurrentRepeatMode: (repeatMode: RepeatMode) => void;
    syncCurrentLyric: (lyric: string) => void;
}

const mod = window["@shared/app-state" as any] as unknown as IMod;
export default mod;
