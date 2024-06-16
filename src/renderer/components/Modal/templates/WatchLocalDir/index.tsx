import {
  getUserPreferenceIDB,
  setUserPreference,
  setUserPreferenceIDB,
} from "@/renderer/utils/user-perference";
import Base from "../Base";
import "./index.scss";
import { hideModal } from "../..";
import { useEffect, useRef, useState } from "react";
import Condition from "@/renderer/components/Condition";
import Empty from "@/renderer/components/Empty";
import { ipcRendererInvoke, ipcRendererSend } from "@/shared/ipc/renderer";
import SvgAsset from "@/renderer/components/SvgAsset";
import Checkbox from "@/renderer/components/Checkbox";
import localMusic from "@/renderer/core/local-music";
import { useTranslation } from "react-i18next";

interface IWatchDirProps {}
export default function WatchLocalDir(props: IWatchDirProps) {
  // 全部的文件夹
  const [localDirs, setLocalDirs] = useState<string[]>([]);
  // 选中的文件夹
  const [checkedDirs, setCheckedDirs] = useState(new Set<string>());
  const changeLogRef = useRef(new Map<string, "add" | "delete">()); // key: path; value: op
  const { t } = useTranslation();

  useEffect(() => {
    (async () => {
      const allDirs = (await getUserPreferenceIDB("localWatchDir")) ?? [];
      const checked =
        (await getUserPreferenceIDB("localWatchDirChecked")) ?? [];
      const allDirsSet = new Set(allDirs);
      const validChecked = checked.filter((it) => allDirsSet.has(it));
      setLocalDirs([...allDirsSet]);
      setCheckedDirs(new Set(validChecked));
    })();
  }, []);

  return (
    <Base defaultClose>
      <div className="modal--watch-local-dir-container shadow backdrop-color">
        <Base.Header>{t("modal.scan_local_music")}</Base.Header>
        <div className="modal--body-container">
          <div className="modal--body-container-title">
            <span>{t("modal.scan_local_music_hint")}</span>
            <div
              role="button"
              data-type="normalButton"
              onClick={async () => {
                const result = await ipcRendererInvoke("show-open-dialog", {
                  title: t("modal.scan_local_music"),
                  properties: ["openDirectory", "createDirectory"],
                });
                if (!result.canceled) {
                  const selected = result.filePaths[0];
                  if (!localDirs.includes(selected)) {
                    const changeLog = changeLogRef.current;
                    setCheckedDirs((prev) => {
                      return new Set([...prev, selected]);
                    });
                    setLocalDirs((prev) => [...prev, selected]);
                    changeLog.set(selected, "add");
                  }
                }
              }}
            >
              {t("modal.add_folder")}
            </div>
          </div>
          <div className="modal--body-scan-content backdrop-color">
            <Condition
              condition={localDirs.length}
              falsy={
                <Empty
                  style={{
                    minHeight: "200px",
                  }}
                ></Empty>
              }
            >
              {localDirs.map((item) => {
                const isChecked = checkedDirs.has(item);

                return (
                  <div
                    className="row-container"
                    key={item}
                    onClick={() => {
                      setCheckedDirs((prev) => {
                        const changeLog = changeLogRef.current;
                        const itemChangeLog = changeLog.get(item);
                        const isChecked = prev.has(item);
                        // 如果此次没有任何变动，说明是旧有的，此时需要删除监听
                        if (!itemChangeLog) {
                          changeLog.set(item, isChecked ? "delete" : "add");
                        } else if (
                          (itemChangeLog === "add" && isChecked) ||
                          (itemChangeLog === "delete" && !isChecked)
                        ) {
                          changeLog.delete(item);
                        }
                        isChecked ? prev.delete(item) : prev.add(item);
                        return new Set(prev);
                      });
                    }}
                  >
                    <Checkbox
                      checked={isChecked}
                      style={{
                        color: isChecked ? "var(--primaryColor)" : undefined,
                      }}
                    ></Checkbox>
                    <div className="title">{item}</div>
                    <div
                      role="button"
                      className="delete-path"
                      onClick={(e) => {
                        e.stopPropagation();
                        const changeLog = changeLogRef.current;
                        const itemChangeLog = changeLog.get(item);
                        // 如果此次没有任何变动，说明是旧有的，此时需要删除监听
                        if (!itemChangeLog) {
                          changeLog.set(item, "delete");
                        } else if (itemChangeLog === "add") {
                          // 此次新增，但是被删掉了
                          changeLog.delete(item);
                          console.log("heredelete", changeLog);
                        }

                        setLocalDirs((prev) =>
                          prev.filter((it) => it !== item)
                        );
                        setCheckedDirs((prev) => {
                          prev.delete(item);
                          return new Set(prev);
                        });
                      }}
                    >
                      <SvgAsset iconName="trash"></SvgAsset>
                    </div>
                  </div>
                );
              })}
            </Condition>
          </div>
        </div>
        <div className="footer-options">
          <div
            role="button"
            data-type="primaryButton"
            onClick={async () => {
              setUserPreferenceIDB("localWatchDir", localDirs);
              setUserPreferenceIDB("localWatchDirChecked", [...checkedDirs]);
              localMusic.changeWatchPath(changeLogRef.current);
              hideModal();
            }}
          >
            {t("common.confirm")}
          </div>
        </div>
      </div>
    </Base>
  );
}
