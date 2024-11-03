import {ICommon} from "music-metadata/lib/aiff/AiffToken";


interface IMod {
    dragWindow(position: ICommon.IPoint): void;
}

const WindowDrag = window["@shared/window-drag" as any] as unknown as IMod;

export default WindowDrag;
