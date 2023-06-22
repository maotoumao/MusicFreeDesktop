declare namespace IUserPerference {
    interface IType {
        /** 重复模式 */
        repeatMode: string;
        /** 当前进度 */
        currentMusic: IMusic.IMusicItem;
        currentProgress: number;
    }

    interface IDBType {
        /** 当前播放队列 */
        playList: IMusic.IMusicItem[];
    }
}