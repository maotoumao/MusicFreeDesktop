import { useParams } from "react-router-dom";
import "./index.scss";
import Condition from "@/renderer/components/Condition";
import { localPluginName } from "@/common/constant";
import LocalSheet from "./local-sheet";
import RemoteSheet from "./remote-sheet";

/**
 * path: /main/musicsheet/platform/id
 *
 * state: {
 *  musicSheet: IMusic.MusicSheetItem
 * }
 *
 */
export default function MusicSheetView() {
  const { platform } = useParams() ?? {};

  return (
    <>
      <Condition
        condition={platform === localPluginName}
        falsy={<RemoteSheet></RemoteSheet>}
      >
        <LocalSheet></LocalSheet>
      </Condition>
    </>
  );
}
