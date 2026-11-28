const metaReg = /\[(.+):(.+)\]/g;

type LyricMeta = Record<string, any>;

interface IOptions {
    musicItem?: IMusic.IMusicItem;
    translation?: string;
}

export interface IParsedLrcItem {
    /** 时间 s */
    time: number;
    /** 歌词 */
    lrc: string;
    /** 翻译 */
    translation?: string;
    /** 位置 */
    index: number;
}

export default class LyricParser {
    public hasTranslation = false;

    private _musicItem?: IMusic.IMusicItem;

    private meta: LyricMeta;
    private lrcItems: Array<IParsedLrcItem>;

    get musicItem() {
        return this._musicItem;
    }

    constructor(raw: string, options?: IOptions) {
        // init
        this._musicItem = options?.musicItem;
        let translation = options?.translation;
        if (!raw && translation) {
            raw = translation;
            translation = undefined;
        }

        const { lrcItems, meta } = this.parseLyricImpl(raw);
        this.meta = meta;
        this.lrcItems = lrcItems;

        if (translation) {
            const transLrcItems = this.parseLyricImpl(translation).lrcItems;

            if (transLrcItems.length > 0) {
                this.hasTranslation = true;

                // Two-pointer merge: both arrays are sorted by time
                let p2 = 0;
                for (let p1 = 0; p1 < this.lrcItems.length; ++p1) {
                    const lrcItem = this.lrcItems[p1];
                    while (p2 < transLrcItems.length - 1 && transLrcItems[p2].time < lrcItem.time) {
                        ++p2;
                    }
                    lrcItem.translation =
                        transLrcItems[p2].time === lrcItem.time ? transLrcItems[p2].lrc : '';
                }
            }
        }
    }

    /** Binary search: find the last lrcItem where time <= position, O(log n) */
    getPosition(position: number): IParsedLrcItem | null {
        position = position - (this.meta?.offset ?? 0);
        const items = this.lrcItems;

        if (!items.length || position < items[0].time) {
            return null;
        }

        let lo = 0;
        let hi = items.length - 1;
        while (lo <= hi) {
            const mid = (lo + hi) >>> 1;
            if (items[mid].time <= position) {
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return items[hi];
    }

    getLyricItems() {
        return this.lrcItems;
    }

    getMeta() {
        return this.meta;
    }

    toString(options?: { withTimestamp?: boolean; type?: 'raw' | 'translation' }) {
        const { type = 'raw', withTimestamp = true } = options || {};

        if (withTimestamp) {
            return this.lrcItems
                .map(
                    (item) =>
                        `${this.timeToLrctime(item.time)} ${
                            type === 'raw' ? item.lrc : item.translation
                        }`,
                )
                .join('\r\n');
        } else {
            return this.lrcItems
                .map((item) => (type === 'raw' ? item.lrc : item.translation))
                .join('\r\n');
        }
    }

    /** [xx:xx.xx] => x s */
    private parseTime(timeStr: string): number {
        let result = 0;
        const nums = timeStr.slice(1, timeStr.length - 1).split(':');
        for (let i = 0; i < nums.length; ++i) {
            result = result * 60 + +nums[i];
        }
        return result;
    }
    /** x s => [xx:xx.xx] */
    private timeToLrctime(sec: number) {
        const min = Math.floor(sec / 60);
        sec = sec - min * 60;
        const secInt = Math.floor(sec);
        const secFloat = sec - secInt;
        return `[${min.toFixed(0).padStart(2, '0')}:${secInt
            .toString()
            .padStart(2, '0')}.${secFloat.toFixed(2).slice(2)}]`;
    }

    private parseMetaImpl(metaStr: string) {
        if (metaStr === '') {
            return {};
        }
        const metaArr = metaStr.match(metaReg) ?? [];
        const meta: any = {};
        let k, v;
        for (const m of metaArr) {
            k = m.substring(1, m.indexOf(':'));
            v = m.substring(k.length + 2, m.length - 1);
            if (k === 'offset') {
                meta[k] = +v / 1000;
            } else {
                meta[k] = v;
            }
        }
        return meta;
    }

    private parseLyricImpl(raw: string) {
        raw = raw.trim();

        const timeRegLocal = /\[[\d:.]+\]/g;
        const rawLrcs = raw.split(timeRegLocal);
        const rawTimes = raw.match(timeRegLocal) ?? [];
        const len = rawTimes.length;

        const meta = this.parseMetaImpl(rawLrcs[0].trim());

        // Use cursor instead of shift() to avoid O(n²) array re-indexing
        let cursor = 1;
        const rawLrcItems: Array<IParsedLrcItem> = [];

        for (let i = 0; i < len; ++i) {
            let counter = 0;
            while (rawLrcs[cursor] === '') {
                ++counter;
                ++cursor;
            }
            const lrc = rawLrcs[cursor]?.trim() ?? '';
            for (let j = i; j < i + counter; ++j) {
                rawLrcItems.push({
                    time: this.parseTime(rawTimes[j]),
                    lrc,
                    index: 0,
                });
            }
            i += counter;
            if (i < len) {
                rawLrcItems.push({
                    time: this.parseTime(rawTimes[i]),
                    lrc,
                    index: 0,
                });
            }
            ++cursor;
        }

        // Sort by time, then reassign continuous indices
        rawLrcItems.sort((a, b) => a.time - b.time);
        for (let i = 0; i < rawLrcItems.length; ++i) {
            rawLrcItems[i].index = i;
        }

        let lrcItems = rawLrcItems;
        if (lrcItems.length === 0 && raw.length) {
            lrcItems = raw.split('\n').map((line, index) => ({
                time: 0,
                lrc: line,
                index,
            }));
        }

        return {
            lrcItems,
            meta,
        };
    }
}
