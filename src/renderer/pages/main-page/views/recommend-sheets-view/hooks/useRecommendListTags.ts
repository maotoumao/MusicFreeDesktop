import { callPluginDelegateMethod } from "@/renderer/core/plugin-delegate";
import { useCallback, useEffect, useState } from "react";

export default function (plugin: IPlugin.IPluginDelegate) {
  const [tags, setTags] = useState<IPlugin.IGetRecommendSheetTagsResult | null>(
    null
  );

  const query = useCallback(async () => {
    try {
      const result = await callPluginDelegateMethod(
        plugin,
        "getRecommendSheetTags"
      );
      if (!result) {
        throw new Error();
      }
      setTags(result);
    } catch {
      setTags({
        pinned: [],
        data: [],
      });
    }
  }, []);

  useEffect(() => {
    query();
  }, []);

  return tags;
}
