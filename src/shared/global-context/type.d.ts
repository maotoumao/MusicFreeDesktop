export interface IGlobalContext {
  /** 版本号 */
  appVersion: string;
  workersPath: {
    /** 下载器worker */
    downloader: string;
    /** 本地文件监听器worker */
    localFileWatcher: string;
    /** 用于备份文件的worker */
    db: string;
  };
  appPath: {
    userData: string;
    temp: string;
    downloads: string;
  };
  platform: NodeJS.Platform;
}
