import { ipcRendererSend } from "@/shared/ipc/renderer";

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
          ipcRendererSend("open-url", props.href);
        }
        props?.onClick?.(...args);
      }}
    ></a>
  );
}
