import "./index.scss";
import routers from "./routers";
import { useEffect, useRef, useState } from "react";
import { IConfig } from "@/shared/app-config/type";
import Condition from "@/renderer/components/Condition";
import { useAppConfig } from "@/shared/app-config/renderer";
import { useTranslation } from "react-i18next";
import camelToSnake from "@/common/camel-to-snake";

export default function SettingView() {
  const appConfig = useAppConfig();
  console.log(appConfig);
  const [selected, setSelected] = useState(routers[0].id);
  const { t } = useTranslation();

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
      document
        .getElementById("page-container")
        ?.classList?.remove("page-container-full-width");

      intersectionObserverRef.current.disconnect();
      intersectionObserverRef.current = null;
      intersectionRatioRef.current.clear();
      intersectionRatioRef.current = null;
    };
  }, []);

  return (
    <div
      id="page-container"
      className="page-container-fw setting-view--container"
    >
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
              {t(`settings.section_name.${camelToSnake(setting.id)}`)}
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
              <div className="setting-view--body-title">
                {t(`settings.section_name.${camelToSnake(setting.id)}`)}
              </div>
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
