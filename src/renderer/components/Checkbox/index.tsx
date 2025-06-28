import { CSSProperties } from "react";
import SvgAsset from "../SvgAsset";
import "./index.scss";

interface ICheckboxProps {
    checked?: boolean;
    onChange?: (newChecked: boolean) => void;
    style?: CSSProperties
}

export default function Checkbox(props: ICheckboxProps) {
    const { checked, onChange, style } = props;

    return (
        <div
            className="checkbox-container"
            style={style}
            role={onChange ? "button" : undefined}
            onClick={() => {
                onChange?.(!checked);
            }}
        >
            {checked ? <SvgAsset iconName="check"></SvgAsset> : null}
        </div>
    );
}
