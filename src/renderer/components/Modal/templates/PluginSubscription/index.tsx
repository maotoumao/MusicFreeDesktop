import {
  getUserPerference,
  setUserPerference,
} from "@/renderer/utils/user-perference";
import { hideModal } from "../..";
import Base from "../Base";
import "./index.scss";
import { ReactNode, useState } from "react";
import Condition from "@/renderer/components/Condition";
import Empty from "@/renderer/components/Empty";
import { toast } from "react-toastify";

interface IReconfirmProps {}

export default function PluginSubscription(props: IReconfirmProps) {
  const [subscription, setSubscription] = useState(
    getUserPerference("subscription") ?? []
  );

  return (
    <Base withBlur={false}>
      <div className="modal--plugin-subscription shadow backdrop-color">
        <Base.Header>插件订阅</Base.Header>
        <div className="content-container">
          <Condition condition={subscription.length} falsy={<Empty></Empty>}>
            {subscription.map((item, index) => (
              <div className="content-item" key={index}>
                <div className="content-item-row">
                  <span>备注: </span>
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
                  <span>链接: </span>
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
            添加
          </div>
          <div
            role="button"
            data-type="dangerButton"
            data-fill={true}
            onClick={() => {
              setUserPerference(
                "subscription",
                subscription.filter((item) =>
                  item.srcUrl.match(/https?:\/\/.+\.js(on)?/)
                )
              );
              toast.success('已保存订阅地址')
              hideModal();
            }}
          >
            保存
          </div>
        </div>
      </div>
    </Base>
  );
}
