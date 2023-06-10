import { ReactNode } from "react";
import "./index.scss";

interface ITagProps {
  children: ReactNode;
}

export default function Tag(props: ITagProps) {
  return (
    <div
      className="components--tag-container"
      title={typeof props.children === "string" ? props.children : undefined}
    >
      {props.children}
    </div>
  );
}
