import { RequestStateCode } from "@/common/constant";
import SwitchCase from "../SwitchCase";
import "./index.scss";

interface IProps {
  state: RequestStateCode;
  onLoadMore?: () => void;
}

export default function BottomLoadingState(props: IProps) {
  const { state, onLoadMore } = props;

  return (
    <SwitchCase.Switch switch={state}>
      <SwitchCase.Case case={RequestStateCode.FINISHED}>
        <div className="bottom-loading-state bottom-loading-state--reach-end">
          ~~~ 到底啦 ~~~
        </div>
      </SwitchCase.Case>
      <SwitchCase.Case case={RequestStateCode.PENDING_REST_PAGE}>
        <div className="bottom-loading-state bottom-loading-state--loading">
          <div className="lds-dual-ring"></div> 加载中...
        </div>
      </SwitchCase.Case>
      <SwitchCase.Case case={RequestStateCode.PARTLY_DONE}>
        <div
          className="bottom-loading-state bottom-loading-state--loadmore"
          role="button"
          onClick={onLoadMore}
        >
          加载更多
        </div>
      </SwitchCase.Case>
    </SwitchCase.Switch>
  );
}
