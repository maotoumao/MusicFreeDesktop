import { ipcRendererInvoke, ipcRendererOn } from "@/shared/ipc/renderer";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Evt from "../core/events";
import { getUserPerference } from "../utils/user-perference";
import { compare } from "compare-versions";
import { showModal } from "../components/Modal";
import checkUpdate from "../utils/check-update";
import { getAppConfigPath } from "@/shared/app-config/renderer";
import Themepack from "@/shared/themepack/renderer";

export default function useBootstrap() {
  const navigate = useNavigate();

  useEffect(() => {
    if (Themepack.currentThemePackStore.getValue()) {
      Themepack.selectTheme(Themepack.currentThemePackStore.getValue());
    }

    const navigateCallback = (url: string, payload?: any) => {
      /**
       * evt:// 协议 触发任意事件
       */
      if (url.startsWith("evt://")) {
        const evtName = url.slice(6);
        if (evtName !== "NAVIGATE") {
          Evt.emit(evtName as any, payload);
        }
      } else {
        navigate(url, {
          state: payload,
        });
      }
    };
    // Evt.on('NAVIGATE', navigateCallback);
    ipcRendererOn("navigate", (args) => {
      if (typeof args === "string") {
        navigateCallback(args);
      } else {
        navigateCallback(args.url, args.payload);
      }
    });

    if (getAppConfigPath("normal.checkUpdate")) {
      checkUpdate();
    }
  }, []);
}
