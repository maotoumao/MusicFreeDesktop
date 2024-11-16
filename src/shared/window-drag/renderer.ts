import {ICommon} from "music-metadata/lib/aiff/AiffToken";
import {getGlobalContext} from "@shared/global-context/renderer";


interface IMod {
    dragWindow(position: ICommon.IPoint): void;
}

const mod = window["@shared/window-drag" as any] as unknown as IMod;

let startClientPos: ICommon.IPoint | null = null;
let isMoving = false;
let injected = false;


function injectHandler() {
    const task = () => setTimeout(() => {
        if (injected) {
            return;
        }
        injected = true;

        if (getGlobalContext().platform !== "win32") {
            // win32使用make-window-fully-draggable方案
            window.addEventListener("mousedown", (e) => {
                startClientPos = {
                    x: e.clientX,
                    y: e.clientY,
                };
                isMoving = true;
            });
            window.addEventListener("mousemove", (e) => {
                if (startClientPos && isMoving) {
                    mod.dragWindow({
                        x: e.screenX - startClientPos.x,
                        y: e.screenY - startClientPos.y,
                    })
                }
            });

            window.addEventListener("mouseup", () => {
                isMoving = false;
                startClientPos = null;
            });
        }
    });

    if (document.readyState === "complete") {
        task();
    } else {
        document.onload = task;
    }
}

const WindowDrag = {
    injectHandler,
}

export default WindowDrag;
