import {useEffect, useRef, useState} from "react";
import {RequestStateCode} from "@/common/constant";
import PluginManager from "@shared/plugin-manager/renderer";

export default function useComment(musicItem: IMusic.IMusicItem) {
    const [comments, setComments] = useState<IComment.IComment[]>([]);
    const [requestStateCode, setRequestStateCode] = useState(RequestStateCode.IDLE)
    const pageRef = useRef(1);

    const loadMore = async () => {
        try {
            if (requestStateCode & RequestStateCode.LOADING) {
                return;
            }
            setRequestStateCode(comments.length > 0 ? RequestStateCode.PENDING_REST_PAGE : RequestStateCode.PENDING_FIRST_PAGE);
            const response = await PluginManager.callPluginDelegateMethod(musicItem, "getMusicComments", musicItem, pageRef.current);

            setComments(prev => prev.concat(response.data ?? []));
            if (response.isEnd === false) {
                setRequestStateCode(RequestStateCode.PARTLY_DONE);
                pageRef.current = pageRef.current + 1;
            } else {
                setRequestStateCode(RequestStateCode.FINISHED);
            }
        } catch {
            setRequestStateCode(RequestStateCode.ERROR);
        }
    }


    useEffect(() => {
        loadMore();
    }, []);


    return [comments, requestStateCode, loadMore] as const;
}
