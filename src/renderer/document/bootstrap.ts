import { localPluginHash, supportLocalMediaType } from "@/common/constant";
import MusicSheet from "../core/music-sheet";
import {
  callPluginDelegateMethod,
  registerPluginEvents,
} from "../core/plugin-delegate";
import trackPlayer from "../core/track-player";
import rendererAppConfig from "@/common/app-config/renderer";

export default async function () {
  await Promise.all([
    rendererAppConfig.setupRendererAppConfig(),
    registerPluginEvents(),
    MusicSheet.setupSheets(),
    trackPlayer.setupPlayer(),
  ]);
  dropHandler();
}

function dropHandler() {
  document.addEventListener("drop", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const validMusicList: IMusic.IMusicItem[] = [];
    for (const f of event.dataTransfer.files) {
      
      if (supportLocalMediaType.some((postfix) => f.path.endsWith(postfix))) {
        validMusicList.push(
          await callPluginDelegateMethod(
            {
              hash: localPluginHash,
            },
            "importMusicItem",
            f.path
          )
        );
      }
    }
    if (validMusicList.length) {
      trackPlayer.playMusicWithReplaceQueue(validMusicList);
    }
  });

  document.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
}
