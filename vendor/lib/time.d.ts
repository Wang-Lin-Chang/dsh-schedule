export declare function parseAbsolute(at: string, timeZone?: string): number;
/** IANA 时区 → UTC epoch（Intl 反推偏移 + 回转换检测 DST 缺口/重叠歧义） */
export declare function zonedToEpoch(local: string, tz: string): number;
