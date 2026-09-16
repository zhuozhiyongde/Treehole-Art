import { describe, expect, it, vi } from 'vitest';
import {
    createFeedBranches,
    describeFeedFailures,
    fetchNextFeedBatch,
    waitForRequestInterval,
} from './feedPagination';

interface Item {
    pid: number;
}

describe('fetchNextFeedBatch', () => {
    it('requests branches serially with an interval between them', async () => {
        const events: string[] = [];
        let activeRequests = 0;
        let maxActiveRequests = 0;
        const wait = vi.fn(async (milliseconds: number) => {
            events.push(`wait:${milliseconds}`);
        });

        const result = await fetchNextFeedBatch<Item>({
            branches: createFeedBranches(['AI', 'LLM']),
            pageSize: 8,
            signal: new AbortController().signal,
            wait,
            now: () => 1_000,
            request: async (keyword, page) => {
                activeRequests += 1;
                maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
                events.push(`request:${keyword}:${page}`);
                await Promise.resolve();
                activeRequests -= 1;
                return { items: [{ pid: keyword === 'AI' ? 1 : 2 }], total: 1, lastPage: 1 };
            },
        });

        expect(events).toEqual(['request:AI:1', 'wait:200', 'request:LLM:1']);
        expect(maxActiveRequests).toBe(1);
        expect(result.results).toHaveLength(2);
        expect(result.hasMore).toBe(false);
    });

    it('keeps the interval across pagination batches', async () => {
        const events: string[] = [];
        const pacing = {};
        let currentTime = 1_000;
        const branches = createFeedBranches(['AI']);
        const options = {
            branches,
            pageSize: 8,
            signal: new AbortController().signal,
            pacing,
            now: () => currentTime,
            wait: async (milliseconds: number) => {
                events.push(`wait:${milliseconds}`);
                currentTime += milliseconds;
            },
            request: async (_keyword: string, page: number) => {
                events.push(`request:${page}`);
                return {
                    items: Array.from({ length: 8 }, (_, index) => ({ pid: page * 100 + index })),
                    total: 16,
                    lastPage: 2,
                };
            },
        };

        await fetchNextFeedBatch(options);
        await fetchNextFeedBatch(options);

        expect(events).toEqual(['request:1', 'wait:200', 'request:2']);
    });

    it('skips branches that have already reached their last page', async () => {
        const branches = createFeedBranches(['short', 'long']);
        const calls: string[] = [];
        const request = async (keyword: string, page: number) => {
            calls.push(`${keyword}:${page}`);
            return {
                items: Array.from({ length: 8 }, (_, index) => ({ pid: page * 100 + index })),
                total: keyword === 'short' ? 8 : 24,
                lastPage: keyword === 'short' ? 1 : 3,
            };
        };
        const options = {
            branches,
            pageSize: 8,
            signal: new AbortController().signal,
            request,
            wait: async () => undefined,
        };

        await fetchNextFeedBatch(options);
        await fetchNextFeedBatch(options);

        expect(calls).toEqual(['short:1', 'long:1', 'long:2']);
        expect(branches.get('short')?.exhausted).toBe(true);
        expect(branches.get('long')?.nextPage).toBe(3);
    });

    it('keeps successful branches when another branch fails', async () => {
        const branches = createFeedBranches(['broken', 'healthy']);
        const calls: string[] = [];
        const options = {
            branches,
            pageSize: 8,
            signal: new AbortController().signal,
            wait: async () => undefined,
            request: async (keyword: string, page: number) => {
                calls.push(`${keyword}:${page}`);
                if (keyword === 'broken') throw new Error('temporary failure');
                return {
                    items: Array.from({ length: 8 }, (_, index) => ({ pid: page * 100 + index })),
                    total: 16,
                    lastPage: 2,
                };
            },
        };

        const first = await fetchNextFeedBatch(options);
        const second = await fetchNextFeedBatch(options);

        expect(first.results.map((result) => result.keyword)).toEqual(['healthy']);
        expect(first.failures).toEqual([
            { keyword: 'broken', page: 1, message: 'temporary failure' },
        ]);
        expect(second.results.map((result) => [result.keyword, result.page])).toEqual([['healthy', 2]]);
        expect(calls).toEqual(['broken:1', 'healthy:1', 'healthy:2']);
        expect(second.hasMore).toBe(false);
    });

    it('cancels an interval wait when the search is aborted', async () => {
        const controller = new AbortController();
        const waiting = waitForRequestInterval(200, controller.signal);

        controller.abort();

        await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('distinguishes partial failures from a fully failed first batch', () => {
        const failures = [{ keyword: 'AI', page: 1, message: '请求失败' }];

        expect(describeFeedFailures(failures)).toContain('部分搜索条件加载失败');
        expect(describeFeedFailures(failures, true)).toContain('所有搜索条件加载失败');
    });
});
