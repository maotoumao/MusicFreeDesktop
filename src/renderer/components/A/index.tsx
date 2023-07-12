import { ipcRendererSend } from "@/common/ipc-util/renderer"


export default function A(props: React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>){
    return <a {...props} href={undefined} onClick={() => {
        ipcRendererSend('open-url', props.href);
    }}></a>
}