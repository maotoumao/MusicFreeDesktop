import Base from "../Base";
import "./index.scss";

interface IProps {}

export default function ExitConfirm() {
  return (
    <Base withBlur>
      <div className="modal--exit-confirm-container shadow backdrop-color">
        确认退出?
      </div>
    </Base>
  );
}
