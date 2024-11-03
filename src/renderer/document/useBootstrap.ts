import { ipcRendererOn } from "@/shared/ipc/renderer";
import { useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import Evt from "../core/events";
import checkUpdate from "../utils/check-update";
import Themepack from "@/shared/themepack/renderer";
import logger from "@shared/logger/renderer";
import AppConfig from "@/shared/app-config.new/renderer";

export default function useBootstrap() {
  const navigate = useNavigate();

  useLayoutEffect(() => {
    Themepack.setupThemePacks();
  }, []);

  useEffect(() => {
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

    if (AppConfig.getConfig("normal.checkUpdate")) {
      checkUpdate();
    }
    logger.logPerf("Bundle First Screen");
  }, []);
}
