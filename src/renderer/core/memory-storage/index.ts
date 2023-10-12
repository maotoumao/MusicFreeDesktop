
type IKey = string | number;
const _memoryStorage = new Map<IKey, any>();

function getItem(key: IKey) {
    return _memoryStorage.get(key) ?? null;
}

function setItem(key: IKey, value: any) {
    _memoryStorage.set(key, value);
}

const memoryStorage = {
    getItem,
    setItem
}

// TODO: LRU等
export default memoryStorage;