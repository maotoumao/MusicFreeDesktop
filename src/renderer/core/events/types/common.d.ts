// 播放控制
declare namespace IEventType {
    interface IEvents {
        /** 路由导航 */
        NAVIGATE: string;
        // 音乐下载完成
        MUSIC_DOWNLOADED: IMedia.IMediaBase | IMedia.IMediaBase[];
        // 音乐被移除
        MUSIC_REMOVE_DOWNLOADED: IMedia.IMediaBase | IMedia.IMediaBase[];
    }
}