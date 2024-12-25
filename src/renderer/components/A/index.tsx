import {shellUtil} from "@shared/utils/renderer";

export default function A(
    props: React.DetailedHTMLProps<
        React.AnchorHTMLAttributes<HTMLAnchorElement>,
        HTMLAnchorElement
    >
) {
    return (
        <a
            {...props}
            href={"javascript:void(0);"}
            onClick={(...args) => {
                if (props.href) {
                    shellUtil.openExternal(props.href);
                }
                props?.onClick?.(...args);
            }}
        ></a>
    );
}
