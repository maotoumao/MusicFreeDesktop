/** 写入音频文件的标签；未提供的字段保持文件原值 */
export interface IAudioTags {
    title?: string;
    artist?: string;
    album?: string;
    /** 封面（替换文件中已有的图片） */
    cover?: {
        data: Uint8Array;
        mimeType: string;
    };
}

/**
 * 音频文件标签写入服务。
 * 调用方只依赖此接口，具体实现（当前为 taglib-wasm）可整体替换。
 */
export interface IAudioTagWriter {
    /** 当前实现能否写入该文件（按扩展名判断） */
    canWrite(filePath: string): boolean;
    /** 写入标签；失败时抛错 */
    write(filePath: string, tags: IAudioTags): Promise<void>;
}
