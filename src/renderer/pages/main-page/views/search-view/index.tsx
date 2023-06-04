import { getSupportedPlugin, useSupportedPlugin } from "@/renderer/core/plugin-delegate";
import { useEffect } from "react";
import { useMatch } from "react-router-dom";
import './index.scss';
import NoPlugin from "@/renderer/components/NoPlugin";


export default function SearchView() {
  const match = useMatch("/main/search/:query");
  const query = match?.params?.query;

  const plugins = useSupportedPlugin("search");



  useEffect(() => {
    console.log(getSupportedPlugin("search"));
    console.log(plugins);
  }, [query])

  useEffect(() => {

  }, []);
  
  console.log(plugins, plugins.length, getSupportedPlugin("search"));
  
  return (
    <div className="search-view-container">
      <div className="search-header"><span className="highlight">「{query}」</span>的搜索结果</div>
      {
        plugins.length ? "ddd" : <NoPlugin supportMethod="搜索"></NoPlugin>
      }
    </div>
  );
}
