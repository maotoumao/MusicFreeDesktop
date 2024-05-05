// 播放控制
declare namespace IEventType {
  interface IEvents {
    /** 设置播放/暂停 */
    SET_PLAYER_STATE: import("@renderer/core/track-player/enum").PlayerState,
    /** 切换播放状态 */
    TOGGLE_PLAYER_STATE: undefined,
    /** 播放上一首 */
    SKIP_PREVIOUS: undefined,
    SKIP_NEXT: undefined,
    VOLUME_UP: number,
    VOLUME_DOWN: number
  }
}
