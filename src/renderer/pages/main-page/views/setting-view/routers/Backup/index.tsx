import { ipcRendererInvoke } from "@/common/ipc-util/renderer";
import "./index.scss";
import MusicSheet from "@/renderer/core/music-sheet";
import { toast } from "react-toastify";

export default function Backup() {
  return (
    <div className="setting-view--backup-container">
      <div className="setting-row backup-row">
        <div
          role="button"
          data-type="normalButton"
          onClick={async () => {
            const result = await ipcRendererInvoke("show-save-dialog", {
              properties: ["showOverwriteConfirmation", "createDirectory"],
              filters: [
                {
                  name: "MusicFree备份文件",
                  extensions: ["json", "txt"],
                },
              ],
              title: "备份到...",
            });
            if (!result.canceled && result.filePath) {
              const sheetDetails = await MusicSheet.frontend.exportAllSheetDetails();
              const backUp = JSON.stringify({
                musicSheets: sheetDetails,
              });
              await window.fs.writeFile(result.filePath, backUp, "utf-8");
              toast.success("备份成功~");
            }
          }}
        >
          备份歌单
        </div>
        <div
          role="button"
          data-type="normalButton"
          onClick={async () => {
            const result = await ipcRendererInvoke("show-open-dialog", {
              properties: ["openFile"],
              filters: [
                {
                  name: "MusicFree备份文件",
                  extensions: ["json", "txt"],
                },
              ],
              title: "打开",
            });
            if (!result.canceled && result.filePaths) {
              try {
                const rawSheets = (await window.fs.readFile(
                  result.filePaths[0],
                  "utf-8"
                )) as string;
                const parsedSheets = JSON.parse(rawSheets);
                const allSheets = parsedSheets.musicSheets;
                for (const sheet of allSheets) {
                  const newSheet = await MusicSheet.frontend.addSheet(sheet.title);
                  await MusicSheet.frontend.addMusicToSheet(sheet.musicList, newSheet.id);
                }
                toast.success("恢复成功~");
              } catch (e) {
                toast.error(`恢复失败: ${e.message}`);
              }
            }
          }}
        >
          恢复歌单
        </div>
      </div>
    </div>
  );
}
