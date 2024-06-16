import { useRef } from "react";
import Base from "../Base";
import "./index.scss";
import { hidePanel } from "../..";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { setAppConfigPath } from "@/shared/app-config/renderer";

interface IUserVariablesProps {
  plugin: IPlugin.IPluginDelegate;
  variables: IPlugin.IUserVariable[];
  initValues?: Record<string, string>;
}

export default function (props: IUserVariablesProps) {
  const { variables = [], initValues = {}, plugin } = props;

  const valueRef = useRef<Record<string, string>>({ ...(initValues ?? {}) });
  const {t} = useTranslation();

  return (
    <Base>
      <Base.Header
        right={
          <div
            role="button"
            className="panel--user-variables-submit"
            onClick={() => {
              setAppConfigPath(
                `private.pluginMeta.${plugin.platform}.userVariables`,
                valueRef.current
              );
              hidePanel();
              toast.success(t("panel.user_variable_setting_success"));
            }}
          >
            {t("common.confirm")}
          </div>
        }
      >
        {plugin.platform ?? ""} {t("panel.user_variable")}
      </Base.Header>
      <div className="panel--user-variables-container">
        {variables.map((variable) => (
          <div className="panel--user-variable-item" key={variable.key}>
            <span title={variable.name ?? variable.key}>
              {variable.name ?? variable.key}
            </span>
            <input
              spellCheck={false}
              defaultValue={initValues[variable.key]}
              onInput={(e) => {
                valueRef.current[variable.key] = (
                  e.target as HTMLInputElement
                ).value;
              }}
              placeholder={variable.hint}
            ></input>
          </div>
        ))}
      </div>
    </Base>
  );
}
