import ReactDOM from "react-dom/client";

import bootstrap from "./bootstrap";

import MinimodePage from "../pages";
import { useEffect, useRef } from "react";
import { ipcRendererSend } from "@/shared/ipc/renderer";
import { getGlobalContext } from "@/shared/global-context/renderer";

import "animate.css";
import "rc-slider/assets/index.css";
import "react-toastify/dist/ReactToastify.css";
import "./index.css"; // 全局样式
import "./index.scss";

bootstrap().then(() => {
  ReactDOM.createRoot(document.getElementById("root")).render(<Root></Root>);
});

function Root() {
  const isMovingRef = useRef(false);
  const startClientPosRef = useRef<ICommon.IPoint | null>(null);

  useEffect(() => {
    const moveWindowHandler = () => {
      setTimeout(() => {
        // hack: inject数据延迟
        if (getGlobalContext().platform !== "win32") {
          // win32使用make-window-fully-draggable方案
          window.addEventListener("mousedown", (e) => {
            startClientPosRef.current = {
              x: e.clientX,
              y: e.clientY,
            };
            isMovingRef.current = true;
          });
          window.addEventListener("mousemove", (e) => {
            if (startClientPosRef.current && isMovingRef.current) {
              ipcRendererSend("set-minimode-window-pos", {
                x: e.screenX - startClientPosRef.current.x,
                y: e.screenY - startClientPosRef.current.y,
              });
            }
          });

          window.addEventListener("mouseup", () => {
            isMovingRef.current = false;
            startClientPosRef.current = null;
          });
        }
      }, 20);
    };
    if (document.readyState === "complete") {
      moveWindowHandler();
    } else {
      document.onload = moveWindowHandler;
    }
  }, []);

  return <MinimodePage></MinimodePage>;
}

// function BootstrapComponent(): null {
//   useBootstrap();

//   return null;
// }
