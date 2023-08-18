/** 配置 */

import About from "./About";
import Backup from "./Backup";
import Download from "./Download";
import Lyric from "./Lyric";
import Normal from "./Normal";
import PlayMusic from "./PlayMusic";
import ShortCut from "./ShortCut";
import Theme from "./Theme";

export default [
  { 
    id: "normal",
    title: "常规",
    component: Normal,
  },
  {
    id: "playMusic",
    title: "播放",
    component: PlayMusic,
  },
  {
    id: "lyric",
    title: "歌词",
    component: Lyric,
  },
  {
    id: "theme",
    title: "主题",
    component: Theme,
  },
  // {
  //   id: "download",
  //   title: "下载",
  //   component: Download,
  // },
  {
    id: "shortCut",
    title: "快捷键",
    component: ShortCut,
  },
  {
    id: "backup",
    title: "备份与恢复",
    component: Backup,
  },
  {
    id: "about",
    title: "关于 MusicFree",
    component: About,
  },
];
