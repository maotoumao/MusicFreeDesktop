/// <reference types="react" />
import { ColorInputBaseProps } from "../types";
interface HexColorInputProps extends ColorInputBaseProps {
    /** Enables `#` prefix displaying */
    prefixed?: boolean;
    /** Allows `#rgba` and `#rrggbbaa` color formats */
    alpha?: boolean;
}
export declare const HexColorInput: (props: HexColorInputProps) => JSX.Element;
export {};
