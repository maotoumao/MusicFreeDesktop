import { contextBridge } from "electron";
import musicSheet from "./music-sheet";
import utils from "./utils";
import localMusic from "./local-music";
import mediaMeta from "./media-meta";

contextBridge.exposeInMainWorld("@shared/app-db", {
  musicSheet,
  utils,
  localMusic,
  mediaMeta,
});
