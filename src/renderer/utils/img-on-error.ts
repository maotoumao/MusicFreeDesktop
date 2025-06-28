import albumImg from "@/assets/imgs/album-cover.jpg";
import { SyntheticEvent } from "react";

export function setFallbackAlbum(evt: SyntheticEvent<HTMLImageElement>) {
    (evt.target as HTMLImageElement).src = albumImg;
}
