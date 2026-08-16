import type { ScheduleConfig, ScheduleInput, ScheduleRecord } from './types.ts';
export declare const MIN_EVERY_INTERVAL_SECONDS = 300;
export declare class ScheduleRegistry {
    static Config: {
        dbPath: string;
        leaseMs: number;
        fallbackPollMs: number;
    };
    private db;
    private leaseMs;
    private fallbackPollMs;
    private nowFn;
    private executor;
    private logger?;
    private who;
    private timer?;
    private pollTimer?;
    private stopped;
    private driving;
    constructor(config?: ScheduleConfig);
    private recover;
    private event;
    create(input: ScheduleInput): ScheduleRecord;
    list(): ScheduleRecord[];
    get(id: string): ScheduleRecord | undefined;
    delete(id: string): {
        id: string;
        deleted: boolean;
        code?: string;
    };
    private nextId;
    private row;
    claim(id: string, now: number, who?: string, leaseMs?: number): boolean;
    dispatch(id: string, who?: string): 'dispatched' | 'not-held' | 'not-overdue';
    /** 执行 action（宿主注入的 executor；缺省 → retry 保持 overdue） */
    executeAction(rec: ScheduleRecord): 'done' | 'retry';
    private startDriver;
    /** 最近到期单 timer：到期 → sweep → 重排 */
    private scheduleNextTimer;
    /** 唤醒后重读墙钟（时钟回拨不提前触发），推进 overdue → 认领 → 派发 → 重排 */
    private sweep;
    /** 外部触发重排（create/delete 后） */
    drive(): void;
    dispose(): void;
}
