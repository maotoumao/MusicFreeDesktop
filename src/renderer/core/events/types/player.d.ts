// 播放控制
declare namespace IEventType {
  interface IEvents {
    /** 展示播放列表 */
    SWITCH_PLAY_LIST: {
      show: boolean; // 是否展示
    };
    /** 展示音乐详情 */
    SHOW_MUSIC_DETAIL: undefined;
    /** 隐藏音乐详情 */
    HIDE_MUSIC_DETAIL: undefined;
    /** 切换桌面歌词 */
    TOGGLE_DESKTOP_LYRIC: undefined
  }
}
