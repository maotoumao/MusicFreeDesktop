import { SearchResult, ResponseDataDetailed, SearchOptions, WebDAVClientContext } from "../types.js";
export declare function getSearch(context: WebDAVClientContext, searchArbiter: string, options?: SearchOptions): Promise<SearchResult | ResponseDataDetailed<SearchResult>>;
