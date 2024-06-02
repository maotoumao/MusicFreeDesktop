import Loading from "@/renderer/components/Loading";
import "./index.scss";
import useRemoteThemes from "./hooks/useRemoteThemes";
import SwitchCase from "@/renderer/components/SwitchCase";
import { RequestStateCode } from "@/common/constant";
import ThemeItem from "../ThemeItem";
import ThemePack from "@/shared/themepack/renderer";

export default function RemoteThemes() {
  const [themes, loadingState] = useRemoteThemes();
  const currentTheme = ThemePack.useCurrentThemePack();

  return (
    <div className="remote-themes-container">
      <SwitchCase.Switch switch={loadingState}>
        <SwitchCase.Case case={RequestStateCode.PENDING_FIRST_PAGE}>
          <Loading></Loading>
        </SwitchCase.Case>
        <SwitchCase.Case case={RequestStateCode.FINISHED}>
          <div className="remote-themes-inner-container">
            {themes.map((it) => (
              <ThemeItem
                config={it.config}
                key={it.publishName}
                type="remote"
                selected={it.hash && it.hash === currentTheme?.hash}
              ></ThemeItem>
            ))}
          </div>
        </SwitchCase.Case>
      </SwitchCase.Switch>
    </div>
  );
}
