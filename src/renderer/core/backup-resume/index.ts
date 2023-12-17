import MusicSheet from "../music-sheet";

/**
 * 恢复
 * @param data 数据
 * @param overwrite 是否覆写歌单
 */
async function resume(data: string | Record<string, any>, overwrite?: boolean) {
  const dataObj = typeof data === "string" ? JSON.parse(data) : data;

  const currentSheets = MusicSheet.frontend.getAllSheets();
  const allSheets: IMusic.IMusicSheetItem[] = dataObj.musicSheets;

  let importedDefaultSheet;
  for (const sheet of allSheets) {
    if (overwrite && sheet.id === MusicSheet.defaultSheet.id) {
      importedDefaultSheet = sheet;
      continue;
    }
    const newSheet = await MusicSheet.frontend.addSheet(sheet.title);
    await MusicSheet.frontend.addMusicToSheet(sheet.musicList, newSheet.id);
  }
  if (overwrite) {
    for (const sheet of currentSheets) {
      if (sheet.id === MusicSheet.defaultSheet.id) {
        if (importedDefaultSheet) {
          await MusicSheet.frontend.clearSheet(MusicSheet.defaultSheet.id);
          await MusicSheet.frontend.addMusicToFavorite(
            importedDefaultSheet.musicList
          );
        }
      }
      await MusicSheet.frontend.removeSheet(sheet.id);
    }
  }
}

const BackupResume = {
  resume,
};
export default BackupResume;
