import rendererAppConfig from "@/common/app-config/renderer";
import "./index.scss";
import routers from "./routers";
import { useEffect, useRef, useState } from "react";
import { IConfig } from "@/common/app-config/type";
import Condition from "@/renderer/components/Condition";


export default function SettingView() {
  const appConfig = rendererAppConfig.useAppConfig();
  console.log(appConfig);
  const [selected, setSelected] = useState(routers[0].id);

  const intersectionObserverRef = useRef<IntersectionObserver>();
  const bodyContainerRef = useRef<HTMLDivElement>();
  const intersectionRatioRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    intersectionObserverRef.current = new IntersectionObserver(
      (targets) => {
        const ratio = intersectionRatioRef.current;
        targets.forEach((target) => {
          ratio.set(target.target.id, target.intersectionRatio);
        });
        let maxVal = 0;
        let maxId;
        for (const entry of ratio.entries()) {
          if (entry[1] > maxVal) {
            maxId = entry[0];
            maxVal = entry[1];
          }
        }
        setSelected(maxId.slice(8));
      },
      {
        root: bodyContainerRef.current,
        threshold: [0, 0.2, 0.8, 1],
      }
    );

    for (const setting of routers) {
      const target = document.getElementById(`setting-${setting.id}`);
      if (target) {
        intersectionObserverRef.current.observe(target);
      }
    }
    return () => {
      intersectionObserverRef.current.disconnect();
      intersectionObserverRef.current = null;
      intersectionRatioRef.current.clear();
      intersectionRatioRef.current = null;
    };
  }, []);

  return (
    <div className="setting-view--container">
      <div className="setting-view--header">
        <div className="tab-list-container">
          {routers.map((setting) => (
            <div
              key={setting.id}
              className="tab-list-item"
              data-headlessui-state={
                selected === setting.id ? "selected" : null
              }
              role="button"
              onClick={() => {
                document
                  .getElementById(`setting-${setting.id}`)
                  ?.scrollIntoView({
                    behavior: "smooth",
                  });
              }}
            >
              {setting.title}
            </div>
          ))}
        </div>
      </div>
      <div className="setting-view--body" ref={bodyContainerRef}>
        {routers.map((setting, index) => {
          const Component = setting.component as any;

          return (
            <div
              className="setting-view--body-item-container"
              id={`setting-${setting.id}`}
              key={setting.id}
            >
              <div className="setting-view--body-title">{setting.title}</div>
              <Component
                data={appConfig[setting.id as keyof IConfig]}
              ></Component>
              <Condition condition={index !== routers.length - 1}>
                <div className="divider"></div>
              </Condition>
            </div>
          );
        })}
      </div>
    </div>
  );
}
