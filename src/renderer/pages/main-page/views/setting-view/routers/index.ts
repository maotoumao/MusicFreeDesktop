/** 配置 */
import About from "./About";
import Backup from "./Backup";
import Download from "./Download";
import Lyric from "./Lyric";
import Network from "./Network";
import Normal from "./Normal";
import PlayMusic from "./PlayMusic";
import Plugin from "./Plugin";
import ShortCut from "./ShortCut";
import Theme from "./Theme";

export default [
  {
    id: "normal",
    component: Normal,
  },
  {
    id: "playMusic",
    component: PlayMusic,
  },
  {
    id: "download",
    component: Download,
  },
  {
    id: "lyric",
    component: Lyric,
  },
  {
    id: "plugin",
    component: Plugin,
  },
  {
    id: "theme",
    component: Theme,
  },
  {
    id: "shortCut",
    component: ShortCut,
  },
  {
    id: "network",
    component: Network,
  },
  {
    id: "backup",
    component: Backup,
  },
  {
    id: "about",
    component: About,
  },
];
