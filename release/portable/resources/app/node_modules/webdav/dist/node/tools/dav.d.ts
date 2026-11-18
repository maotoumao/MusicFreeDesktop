import { DAVResult, DAVResultResponseProps, DiskQuotaAvailable, FileStat, SearchResult } from "../types.js";
/**
 * Parse an XML response from a WebDAV service,
 *  converting it to an internal DAV result
 * @param xml The raw XML string
 * @returns A parsed and processed DAV result
 */
export declare function parseXML(xml: string): Promise<DAVResult>;
/**
 * Get a file stat result from given DAV properties
 * @param props DAV properties
 * @param filename The filename for the file stat
 * @param isDetailed Whether or not the raw props of the resource should be returned
 * @returns A file stat result
 */
export declare function prepareFileFromProps(props: DAVResultResponseProps, filename: string, isDetailed?: boolean): FileStat;
/**
 * Parse a DAV result for file stats
 * @param result The resulting DAV response
 * @param filename The filename that was stat'd
 * @param isDetailed Whether or not the raw props of
 *  the resource should be returned
 * @returns A file stat result
 */
export declare function parseStat(result: DAVResult, filename: string, isDetailed?: boolean): FileStat;
/**
 * Parse a DAV result for a search request
 *
 * @param result The resulting DAV response
 * @param searchArbiter The collection path that was searched
 * @param isDetailed Whether or not the raw props of the resource should be returned
 */
export declare function parseSearch(result: DAVResult, searchArbiter: string, isDetailed: boolean): SearchResult;
/**
 * Translate a disk quota indicator to a recognised
 *  value (includes "unlimited" and "unknown")
 * @param value The quota indicator, eg. "-3"
 * @returns The value in bytes, or another indicator
 */
export declare function translateDiskSpace(value: string | number): DiskQuotaAvailable;
