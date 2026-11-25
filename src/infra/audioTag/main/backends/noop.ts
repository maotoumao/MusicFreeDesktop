import type { IAudioTagWriter } from '@appTypes/infra/audioTag';

/** 不写入任何标签的空实现 */
const noopBackend: IAudioTagWriter = {
    canWrite: () => false,
    write: async () => {},
};

export default noopBackend;
