import { ipcRendererInvoke } from "@/common/ipc-util/renderer";
import "./index.scss";
import MusicSheet from "@/renderer/core/music-sheet";
import { toast } from "react-toastify";
import { IAppConfig } from "@/common/app-config/type";
import RadioGroupSettingItem from "../../components/RadioGroupSettingItem";
import rendererAppConfig from "@/common/app-config/renderer";
import InputSettingItem from "../../components/InputSettingItem";
import { AuthType, createClient } from "webdav";
import { createTmpFile } from "@/renderer/utils/create-tmp-file";
import BackupResume from "@/renderer/core/backup-resume";

interface IProps {
  data: IAppConfig["backup"];
}

export default function Backup(props: IProps) {
  const { data } = props;

  return (
    <div className="setting-view--backup-container">
      <RadioGroupSettingItem
        value={data?.resumeBehavior}
        keyPath="backup.resumeBehavior"
        options={[
          {
            value: "append",
            title: "追加到已有歌单末尾",
          },
          {
            value: "overwrite",
            title: "覆盖已有歌单",
          },
        ]}
      ></RadioGroupSettingItem>
      <div className={"label-container"}>文件备份</div>
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
              const sheetDetails =
                await MusicSheet.frontend.exportAllSheetDetails();
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

                await BackupResume.resume(
                  rawSheets,
                  rendererAppConfig.getAppConfigPath(
                    "backup.resumeBehavior"
                  ) === "overwrite"
                );

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
      <div className={"label-container setting-row"}>WebDAV 备份</div>
      <div className="webdav-backup-container">
        <InputSettingItem
          width="100%"
          label="URL"
          trim
          keyPath="backup.webdav.url"
          value={data?.webdav?.url}
        ></InputSettingItem>
        <InputSettingItem
          width="100%"
          label="账号"
          trim
          keyPath="backup.webdav.username"
          value={data?.webdav?.username}
        ></InputSettingItem>
        <InputSettingItem
          width="100%"
          label="密码"
          type="password"
          trim
          keyPath="backup.webdav.password"
          value={data?.webdav?.password}
        ></InputSettingItem>
      </div>
      <div className="setting-row backup-row">
        <div
          role="button"
          data-type="normalButton"
          onClick={async () => {
            try {
              if (
                data?.webdav?.url &&
                data?.webdav?.username &&
                data?.webdav?.password
              ) {
                const client = createClient(data.webdav.url, {
                  authType: AuthType.Password,
                  username: data.webdav.username,
                  password: data.webdav.password,
                });
                const sheetDetails =
                  await MusicSheet.frontend.exportAllSheetDetails();
                const backUp = JSON.stringify(
                  {
                    musicSheets: sheetDetails,
                  },
                  undefined,
                  0
                );
                if (!(await client.exists("/MusicFree"))) {
                  await client.createDirectory("/MusicFree");
                }
                // 临时文件
                await client.putFileContents(
                  `/MusicFree/MusicFreeBackup.json`,
                  backUp,
                  {
                    overwrite: true,
                  }
                );
                toast.success("备份成功");
              } else {
                toast.error("URL、账号、密码不可为空");
              }
            } catch (e) {
              toast.error(`备份失败: ${e.message}`);
            }
          }}
        >
          备份歌单
        </div>
        <div
          role="button"
          data-type="normalButton"
          onClick={async () => {
            try {
              if (
                data?.webdav?.url &&
                data?.webdav?.username &&
                data?.webdav?.password
              ) {
                const client = createClient(data.webdav.url, {
                  authType: AuthType.Password,
                  username: data.webdav.username,
                  password: data.webdav.password,
                });

                if (!(await client.exists("/MusicFree/MusicFreeBackup.json"))) {
                  throw new Error("备份文件不存在");
                }
                const resumeData = await client.getFileContents(
                  "/MusicFree/MusicFreeBackup.json",
                  {
                    format: "text",
                  }
                );
                await BackupResume.resume(
                  resumeData,
                  rendererAppConfig.getAppConfigPath(
                    "backup.resumeBehavior"
                  ) === "overwrite"
                );
                toast.success("恢复成功");
              } else {
                toast.error("URL、账号、密码不可为空");
              }
            } catch (e) {
              toast.error(`恢复失败: ${e.message}`);
            }
          }}
        >
          恢复歌单
        </div>
      </div>
    </div>
  );
}
