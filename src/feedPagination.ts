import type { PageResult } from './types';

export const FEED_BRANCH_REQUEST_INTERVAL_MS = 200;

export interface FeedBranchState {
    keyword: string;
    nextPage: number;
    lastPage?: number;
    total?: number;
    exhausted: boolean;
    error?: string;
}

export interface FeedBranchFailure {
    keyword: string;
    page: number;
    message: string;
}

export interface FeedRequestPacingState {
    lastRequestFinishedAt?: number;
}

export interface FeedBranchResult<T> {
    keyword: string;
    page: number;
    result: PageResult<T>;
}

export interface FeedBatchResult<T> {
    results: FeedBranchResult<T>[];
    failures: FeedBranchFailure[];
    total: number;
    hasMore: boolean;
}

export function createFeedBranches(keywords: string[]) {
    return new Map<string, FeedBranchState>(
        keywords.map((keyword) => [
            keyword,
            {
                keyword,
                nextPage: 1,
                exhausted: false,
            },
        ]),
    );
}

function abortError() {
    const error = new Error('请求已取消');
    error.name = 'AbortError';
    return error;
}

export function waitForRequestInterval(milliseconds: number, signal: AbortSignal) {
    if (signal.aborted) return Promise.reject(abortError());
    return new Promise<void>((resolve, reject) => {
        const onAbort = () => {
            clearTimeout(timer);
            reject(abortError());
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, milliseconds);
        signal.addEventListener('abort', onAbort, { once: true });
    });
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error || '请求失败');
}

export async function fetchNextFeedBatch<T>({
    branches,
    pageSize,
    signal,
    request,
    intervalMs = FEED_BRANCH_REQUEST_INTERVAL_MS,
    wait = waitForRequestInterval,
    pacing = {},
    now = Date.now,
}: {
    branches: Map<string, FeedBranchState>;
    pageSize: number;
    signal: AbortSignal;
    request: (keyword: string, page: number, signal: AbortSignal) => Promise<PageResult<T>>;
    intervalMs?: number;
    wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
    pacing?: FeedRequestPacingState;
    now?: () => number;
}): Promise<FeedBatchResult<T>> {
    const requestable = [...branches.values()].filter((branch) => !branch.exhausted && !branch.error);
    const results: FeedBranchResult<T>[] = [];

    for (const branch of requestable) {
        if (pacing.lastRequestFinishedAt !== undefined && intervalMs > 0) {
            const remainingInterval = pacing.lastRequestFinishedAt + intervalMs - now();
            if (remainingInterval > 0) await wait(remainingInterval, signal);
        }
        if (signal.aborted) throw abortError();

        const page = branch.nextPage;
        try {
            const result = await request(branch.keyword, page, signal);
            const lastPage = Number.isFinite(result.lastPage) ? Math.max(1, Math.floor(result.lastPage)) : page;
            branch.lastPage = lastPage;
            branch.total = result.total;
            branch.nextPage = page + 1;
            branch.exhausted = page >= lastPage || result.items.length < pageSize;
            results.push({ keyword: branch.keyword, page, result });
        } catch (error) {
            if ((error as Error)?.name === 'AbortError' || signal.aborted) throw error;
            branch.error = errorMessage(error);
        } finally {
            pacing.lastRequestFinishedAt = now();
        }
    }

    const failures = [...branches.values()]
        .filter((branch): branch is FeedBranchState & { error: string } => Boolean(branch.error))
        .map((branch) => ({
            keyword: branch.keyword,
            page: branch.nextPage,
            message: branch.error,
        }));

    return {
        results,
        failures,
        total: [...branches.values()].reduce((sum, branch) => sum + (branch.total ?? 0), 0),
        hasMore: [...branches.values()].some((branch) => !branch.exhausted && !branch.error),
    };
}

export function describeFeedFailures(failures: FeedBranchFailure[], allFailed = false) {
    if (!failures.length) return '';
    const details = failures
        .map(({ keyword, page, message }) => `${keyword ? `“${keyword}”` : '当前信息流'}第 ${page} 页：${message}`)
        .join('；');
    return `${allFailed ? '所有' : '部分'}搜索条件加载失败，刷新后可重试：${details}`;
}
