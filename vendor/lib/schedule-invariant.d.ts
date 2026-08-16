import type { ScheduleRecord } from './types.ts';
export declare const MIN_FOUR_DIGIT_YEAR_MS: number;
export declare const MAX_FOUR_DIGIT_YEAR_MS: number;
export declare const MIN_EVERY_SECONDS = 300;
/** 官方同款：id 必须 <prefix>-<正整数> */
export declare const SCHEDULE_ID: RegExp;
/**
 * 校验一条调度记录的跨字段关系（官方 validateSnapshot 同款结构）。
 * 违反时调用 fail(稳定诊断)，不抛异常。
 */
export declare function validateSchedule(rec: ScheduleRecord, fail: (msg: string) => void): void;
/** 批量校验：对列表逐条 fail 收集 */
export declare function validateSchedules(recs: ScheduleRecord[], fail: (msg: string) => void): void;
