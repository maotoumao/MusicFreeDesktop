import { ipcRendererInvoke, ipcRendererOn } from "@/common/ipc-util/renderer";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Evt from "../core/events";
import { getUserPerference } from "../utils/user-perference";
import { compare } from "compare-versions";
import { showModal } from "../components/Modal";
import rendererAppConfig from "@/common/app-config/renderer";
import checkUpdate from "../utils/check-update";

export default function useBootstrap() {
  const navigate = useNavigate();

  useEffect(() => {
    if (window.themepack.currentThemePackStore.getValue()) {
      window.themepack.selectTheme(
        window.themepack.currentThemePackStore.getValue()
      );
    }

    const navigateCallback = (url: string, payload?: any) => {
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

    if (rendererAppConfig.getAppConfigPath("normal.checkUpdate")) {
      checkUpdate();
    }
  }, []);
}
