import { RequestStateCode } from "@/common/constant";
import SwitchCase from "../SwitchCase";
import "./index.scss";
import { useTranslation } from "react-i18next";

interface IProps {
  state: RequestStateCode;
  onLoadMore?: () => void;
}

export default function BottomLoadingState(props: IProps) {
  const { state, onLoadMore } = props;

  const {t} = useTranslation();

  return (
    <SwitchCase.Switch switch={state}>
      <SwitchCase.Case case={RequestStateCode.FINISHED}>
        <div className="bottom-loading-state bottom-loading-state--reach-end">
          {t("bottom_loading_state.reached_end")}
        </div>
      </SwitchCase.Case>
      <SwitchCase.Case case={RequestStateCode.PENDING_REST_PAGE}>
        <div className="bottom-loading-state bottom-loading-state--loading">
          <div className="lds-dual-ring"></div> {t("bottom_loading_state.loading")}
        </div>
      </SwitchCase.Case>
      <SwitchCase.Case case={RequestStateCode.PARTLY_DONE}>
        <div
          className="bottom-loading-state bottom-loading-state--loadmore"
          role="button"
          onClick={onLoadMore}
        >
          {t("bottom_loading_state.load_more")}
        </div>
      </SwitchCase.Case>
    </SwitchCase.Switch>
  );
}
