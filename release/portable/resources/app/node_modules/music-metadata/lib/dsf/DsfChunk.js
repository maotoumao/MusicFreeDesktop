import * as Token from 'token-types';
import { FourCcToken } from '../common/FourCC.js';
/**
 * Common chunk DSD header: the 'chunk name (Four-CC)' & chunk size
 */
export const ChunkHeader = {
    len: 12,
    get: (buf, off) => {
        return { id: FourCcToken.get(buf, off), size: Token.UINT64_LE.get(buf, off + 4) };
    }
};
/**
 * Common chunk DSD header: the 'chunk name (Four-CC)' & chunk size
 */
export const DsdChunk = {
    len: 16,
    get: (buf, off) => {
        return {
            fileSize: Token.INT64_LE.get(buf, off),
            metadataPointer: Token.INT64_LE.get(buf, off + 8)
        };
    }
};
export var ChannelType;
(function (ChannelType) {
    ChannelType[ChannelType["mono"] = 1] = "mono";
    ChannelType[ChannelType["stereo"] = 2] = "stereo";
    ChannelType[ChannelType["channels"] = 3] = "channels";
    ChannelType[ChannelType["quad"] = 4] = "quad";
    ChannelType[ChannelType["4 channels"] = 5] = "4 channels";
    ChannelType[ChannelType["5 channels"] = 6] = "5 channels";
    ChannelType[ChannelType["5.1 channels"] = 7] = "5.1 channels";
})(ChannelType || (ChannelType = {}));
/**
 * Common chunk DSD header: the 'chunk name (Four-CC)' & chunk size
 */
export const FormatChunk = {
    len: 40,
    get: (buf, off) => {
        return {
            formatVersion: Token.INT32_LE.get(buf, off),
            formatID: Token.INT32_LE.get(buf, off + 4),
            channelType: Token.INT32_LE.get(buf, off + 8),
            channelNum: Token.INT32_LE.get(buf, off + 12),
            samplingFrequency: Token.INT32_LE.get(buf, off + 16),
            bitsPerSample: Token.INT32_LE.get(buf, off + 20),
            sampleCount: Token.INT64_LE.get(buf, off + 24),
            blockSizePerChannel: Token.INT32_LE.get(buf, off + 32)
        };
    }
};
