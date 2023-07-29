import { bind } from "mousetrap";
import trackPlayer from "../track-player";
import { PlayerState } from "../track-player/enum";

const currentPressedKeys = new Set<string>();

export function setupLocalShortCut() {
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Backspace") {
      currentPressedKeys.add(e.key);
    }
  });

  window.addEventListener("keyup", (e) => {
    currentPressedKeys.delete(e.key);
  });

  // 固定的快捷键
  registerLocalShortCut("space", () => {
    const currentState = trackPlayer.getPlayerState();
    if(currentState === PlayerState.Playing) {
        trackPlayer.pause();
    } else {
        trackPlayer.resumePlay();
    }
  });
}

export function isKeyDown(key: string) {
  return currentPressedKeys.has(key);
}

export function registerLocalShortCut(keys: string | string[], cb: () => void) {
  bind(keys, cb);
}
