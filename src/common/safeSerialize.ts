/**
 * 安全地将任意值序列化为字符串。
 * - 字符串直接返回，零开销
 * - 对象/数组使用 JSON.stringify，捕获循环引用等异常
 * - 其他原始类型走 String()
 */
export function safeStringify(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }

    if (value === null || value === undefined) {
        return String(value);
    }

    // 原始类型（number / boolean / bigint / symbol）直接转字符串，避免 JSON.stringify 开销
    if (typeof value !== 'object' && typeof value !== 'function') {
        return String(value);
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

/**
 * 安全地解析 JSON 字符串，失败时返回 fallback（默认 null）。
 */
export function safeParse<T = unknown>(raw: string, fallback: T | null = null): T | null {
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}
