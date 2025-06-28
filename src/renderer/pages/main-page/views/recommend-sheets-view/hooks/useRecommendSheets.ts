import { RequestStateCode } from "@/common/constant";
import { resetMediaItem } from "@/common/media-util";
import { useCallback, useEffect, useRef, useState } from "react";
import PluginManager from "@shared/plugin-manager/renderer";

export default function (plugin: IPlugin.IPluginDelegate, tag: IMedia.IUnique | null) {
    const [sheets, setSheets] = useState<IMusic.IMusicSheetItem[]>([]);
    const [status, setStatus] = useState<RequestStateCode>(RequestStateCode.IDLE);
    const currentTagRef = useRef<string>();
    const pageRef = useRef(0);

    const query = useCallback(async () => {
        if (
            (RequestStateCode.PENDING_FIRST_PAGE & status ||
        RequestStateCode.FINISHED === status) &&
      currentTagRef.current === tag.id
        ) {
            return;
        }
        if (currentTagRef.current !== tag.id) {
            setSheets([]);
            pageRef.current = 0;
        }
        pageRef.current++;
        currentTagRef.current = tag.id;

        setStatus(
            pageRef.current === 1
                ? RequestStateCode.PENDING_FIRST_PAGE
                : RequestStateCode.PENDING_REST_PAGE,
        );
        const res = await PluginManager.callPluginDelegateMethod(
            plugin,
            "getRecommendSheetsByTag",
            tag,
            pageRef.current,
        );

        if (tag.id === currentTagRef.current) {
            setSheets((prev) => [
                ...prev,
                ...res.data!.map((item) => resetMediaItem(item, plugin.platform)),
            ]);
        }

        if (res.isEnd) {
            setStatus(RequestStateCode.FINISHED);
        } else {
            setStatus(RequestStateCode.PARTLY_DONE);
        }
    }, [tag, status]);

    useEffect(() => {
        if (tag) {
            query();
        }
    }, [tag]);

    return [query, sheets, status] as const;
}
