import { CSSProperties } from "react";
import "./index.scss";

interface IEmptyProps {
  style?: CSSProperties;
}

export default function Empty(props: IEmptyProps) {
  const { style } = props;

  return (
    <div className="components--empty-container" style={style}>
      什么都没有呀~~~
    </div>
  );
}
