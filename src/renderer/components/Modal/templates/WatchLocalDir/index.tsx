import {
  getUserPerferenceIDB,
  setUserPerference,
  setUserPerferenceIDB,
} from "@/renderer/utils/user-perference";
import Base from "../Base";
import "./index.scss";
import { hideModal } from "../..";
import { useEffect, useRef, useState } from "react";
import Condition from "@/renderer/components/Condition";
import Empty from "@/renderer/components/Empty";
import { ipcRendererInvoke, ipcRendererSend } from "@/common/ipc-util/renderer";
import SvgAsset from "@/renderer/components/SvgAsset";

interface IUpdateProps {}
export default function WatchLocalDir(props: IUpdateProps) {
  const [localDirs, setLocalDirs] = useState<string[]>([]);
  const changeLogRef = useRef({
    add: new Set<string>(),
    rm: new Set<string>(),
  });

  useEffect(() => {
    getUserPerferenceIDB("localWatchDir").then((dirs) => {
      setLocalDirs(dirs ?? []);
    });
  }, []);

  return (
    <Base defaultClose>
      <div className="modal--watch-local-dir-container shadow backdrop-color">
        <Base.Header>扫描本地音乐</Base.Header>
        <div className="modal--body-container">
          <Condition
            condition={localDirs.length}
            falsy={
              <Empty
                style={{
                  minHeight: "100px",
                }}
              ></Empty>
            }
          >
            {localDirs.map((item) => (
              <div className="row-container" key={item}>
                <div className="title">{item}</div>
                <div
                  role="button"
                  className="delete-path"
                  onClick={() => {
                    const changeLog = changeLogRef.current;
                    if (changeLog.add.has(item)) {
                      changeLog.add.delete(item);
                    } else {
                      changeLog.rm.add(item);
                    }
                    setLocalDirs((prev) => prev.filter((pth) => pth !== item));
                  }}
                >
                  <SvgAsset iconName="trash"></SvgAsset>
                </div>
              </div>
            ))}
          </Condition>
        </div>
        <div className="footer-options">
          <div
            role="button"
            data-type="normalButton"
            onClick={async () => {
              const result = await ipcRendererInvoke("show-open-dialog", {
                properties: ["openDirectory", "createDirectory"],
              });
              if (!result.canceled) {
                const selected = result.filePaths[0];
                if (!localDirs.includes(selected)) {
                  const changeLog = changeLogRef.current;
                  if (changeLog.rm.has(selected)) {
                    changeLog.rm.delete(selected);
                  } else {
                    changeLog.add.add(selected);
                  }
                  setLocalDirs((prev) => [...prev, selected]);
                }
              }
            }}
          >
            添加文件夹
          </div>
          <div
            role="button"
            data-type="primaryButton"
            onClick={async () => {
              setUserPerferenceIDB("localWatchDir", localDirs);
              ipcRendererSend("set-watch-dir", {
                rm: [...changeLogRef.current.rm],
                add: [...changeLogRef.current.add]
              });
              hideModal();
            }}
          >
            确认
          </div>
        </div>
      </div>
    </Base>
  );
}
