import {
  getUserPreference,
  setUserPreference,
} from "@/renderer/utils/user-perference";
import { hideModal } from "../..";
import Base from "../Base";
import "./index.scss";
import { ReactNode, useState } from "react";
import Condition from "@/renderer/components/Condition";
import Empty from "@/renderer/components/Empty";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

export default function PluginSubscription() {
  const [subscription, setSubscription] = useState(
    getUserPreference("subscription") ?? []
  );

  const { t } = useTranslation();

  return (
    <Base withBlur={false}>
      <div className="modal--plugin-subscription shadow backdrop-color">
        <Base.Header>{t("modal.plugin_subscription")}</Base.Header>
        <div className="content-container">
          <Condition condition={subscription.length} falsy={<Empty></Empty>}>
            {subscription.map((item, index) => (
              <div className="content-item" key={index}>
                <div className="content-item-row">
                  <span>{t("modal.subscription_remarks")}</span>
                  <input
                    defaultValue={item.title ?? ""}
                    onChange={(e) => {
                      setSubscription((prev) => {
                        const newSub = [...prev];
                        newSub[index].title = e.target.value;
                        return newSub;
                      });
                    }}
                  ></input>
                </div>
                <div className="content-item-row">
                  <span>{t("modal.subscription_links")}</span>
                  <input
                    defaultValue={item.srcUrl ?? ""}
                    onChange={(e) => {
                      setSubscription((prev) => {
                        const newSub = [...prev];
                        newSub[index].srcUrl = e.target.value;
                        return newSub;
                      });
                    }}
                  ></input>
                </div>
              </div>
            ))}
          </Condition>
        </div>
        <div className="opeartion-area">
          <div
            role="button"
            data-type="normalButton"
            onClick={() => {
              setSubscription((prev) => [
                ...prev,
                {
                  title: "",
                  srcUrl: "",
                },
              ]);
            }}
          >
            {t("common.add")}
          </div>
          <div
            role="button"
            data-type="dangerButton"
            data-fill={true}
            onClick={() => {
              setUserPreference(
                "subscription",
                subscription.filter((item) =>
                  item.srcUrl.match(/https?:\/\/.+\.js(on)?/)
                )
              );
              toast.success(t("modal.subscription_save_success"));
              hideModal();
            }}
          >
            {t("common.save")}
          </div>
        </div>
      </div>
    </Base>
  );
}
