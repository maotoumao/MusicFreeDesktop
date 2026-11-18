import { DiskQuota, GetQuotaOptions, ResponseDataDetailed, WebDAVClientContext } from "../types.js";
export declare function getQuota(context: WebDAVClientContext, options?: GetQuotaOptions): Promise<DiskQuota | null | ResponseDataDetailed<DiskQuota | null>>;
