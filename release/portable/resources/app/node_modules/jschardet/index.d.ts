export interface IDetectedMap {
    encoding: string,
    confidence: number
}
export interface IOptionsMap {
    minimumThreshold?: number,
    detectEncodings?: Array<string>
}
export function detect(buffer: Buffer | string, options?: IOptionsMap): IDetectedMap;

export function detectAll(buffer: Buffer | string, options?: IOptionsMap): IDetectedMap[];

export function enableDebug(): void;
