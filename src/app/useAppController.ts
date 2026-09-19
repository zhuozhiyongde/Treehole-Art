import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    createBookmark,
    deleteBookmark,
    fetchBlockingWords,
    fetchBookmarks,
    fetchComments,
    fetchFeed,
    fetchHole,
    fetchPostingIdentities,
    fetchTags,
    fetchUnreadNotificationCount,
    setBookmark,
    toggleHolePraise,
    updateBlockingWords,
} from '../api';
import { withoutBookmarkGroup } from '../lib/bookmarks';
import { writeClipboard } from '../lib/clipboard';
import { commentSender, copyTime } from '../lib/presentation';
import { displayText } from '../normalize';
import { matchesAdvancedQuery, parseQuery, type ParsedQuery } from '../search';
import {
    createFeedBranches,
    describeFeedFailures,
    fetchNextFeedBatch,
    type FeedBranchState,
    type FeedRequestPacingState,
} from '../feedPagination';
import type {
    BookmarkGroup,
    BlockingWordMode,
    CommentViewMode,
    FeedMode,
    Hole,
    PostingIdentity,
    TagNode,
    ThemeMode,
    TreeholeComment,
} from '../types';

const PAGE_SIZE = 8;
const SEARCH_HISTORY_KEY = 'treehole-art-search-history';
const SEARCH_HISTORY_LIMIT = 8;
const BLOCKING_WORD_MODE_KEY = 'treehole-art-blocking-word-mode';

function containsBlockingWord(hole: Hole, words: string[]) {
    const text = displayText(hole.text);
    return words.some((word) => text.includes(word));
}

function loadSearchHistory() {
    try {
        const stored = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) ?? '[]');
        return Array.isArray(stored)
            ? stored
                  .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
                  .slice(0, SEARCH_HISTORY_LIMIT)
            : [];
    } catch {
        return [];
    }
}

export function useAppController() {
    const [mode, setMode] = useState<FeedMode>('latest');
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
        const stored = localStorage.getItem('treehole-art-theme');
        return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    });
    const [commentViewMode, setCommentViewMode] = useState<CommentViewMode>(() =>
        localStorage.getItem('treehole-art-comment-view') === 'inline' ? 'inline' : 'modal',
    );
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [docsOpen, setDocsOpen] = useState(false);
    const [queryInput, setQueryInput] = useState('');
    const [activeQuery, setActiveQuery] = useState<ParsedQuery>(() => parseQuery(''));
    const [recentSearches, setRecentSearches] = useState<string[]>(loadSearchHistory);
    const [selectedLabel, setSelectedLabel] = useState<number | undefined>();
    const [selectedBookmark, setSelectedBookmark] = useState<number | undefined>();
    const [tags, setTags] = useState<TagNode[]>([]);
    const [bookmarkGroups, setBookmarkGroups] = useState<BookmarkGroup[]>([]);
    const [blockingWords, setBlockingWords] = useState<string[]>([]);
    const [blockingWordMode, setBlockingWordMode] = useState<BlockingWordMode>(() =>
        localStorage.getItem(BLOCKING_WORD_MODE_KEY) === 'hide' ? 'hide' : 'collapse',
    );
    const [postingIdentities, setPostingIdentities] = useState<PostingIdentity[]>([]);
    const [holes, setHoles] = useState<Hole[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [candidateTotal, setCandidateTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [feedError, setFeedError] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);
    const [selectedHole, setSelectedHole] = useState<Hole | null>(null);
    const [detailStack, setDetailStack] = useState<Hole[]>([]);
    const [detailLoadingPid, setDetailLoadingPid] = useState<number | null>(null);
    const [expandedCommentPids, setExpandedCommentPids] = useState<Set<number>>(() => new Set());
    const [bookmarkMenuPid, setBookmarkMenuPid] = useState<number | null>(null);
    const [copyMenuPid, setCopyMenuPid] = useState<number | null>(null);
    const [bookmarkBusy, setBookmarkBusy] = useState(false);
    const [bookmarkDeleteTarget, setBookmarkDeleteTarget] = useState<BookmarkGroup | null>(null);
    const [blockingWordsOpen, setBlockingWordsOpen] = useState(false);
    const [blockingWordsBusy, setBlockingWordsBusy] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [likingPids, setLikingPids] = useState<Set<number>>(() => new Set());
    const [toast, setToast] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);
    const feedController = useRef<AbortController | null>(null);
    const detailRequestController = useRef<AbortController | null>(null);
    const feedSentinelRef = useRef<HTMLDivElement>(null);
    const loadMoreAction = useRef<() => void>(() => undefined);
    const feedBranches = useRef<Map<string, FeedBranchState>>(new Map());
    const feedRequestPacing = useRef<FeedRequestPacingState>({});
    const loadingMoreRef = useRef(false);

    const refreshUnreadCount = useCallback(async () => {
        const results = await Promise.allSettled([
            fetchUnreadNotificationCount('int_msg'),
            fetchUnreadNotificationCount('sys_msg'),
        ]);
        setUnreadNotifications(
            results.reduce((total, result) => total + (result.status === 'fulfilled' ? result.value : 0), 0),
        );
    }, []);

    const updateTheme = useCallback((preference: ThemeMode) => {
        const dark =
            preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.dataset.treeholeTheme = dark ? 'dark' : 'light';
    }, []);

    useEffect(() => {
        updateTheme(themeMode);
        localStorage.setItem('treehole-art-theme', themeMode);
        const media = matchMedia('(prefers-color-scheme: dark)');
        const listener = () => themeMode === 'system' && updateTheme(themeMode);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, [themeMode, updateTheme]);

    useEffect(() => {
        localStorage.setItem('treehole-art-comment-view', commentViewMode);
    }, [commentViewMode]);

    useEffect(() => {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(recentSearches));
    }, [recentSearches]);

    useEffect(() => {
        localStorage.setItem(BLOCKING_WORD_MODE_KEY, blockingWordMode);
    }, [blockingWordMode]);

    useEffect(() => {
        if (blockingWordMode !== 'hide' || !blockingWords.length) return;
        setSelectedHole((current) => (current && containsBlockingWord(current, blockingWords) ? null : current));
        setDetailStack((current) =>
            current.some((hole) => containsBlockingWord(hole, blockingWords)) ? [] : current,
        );
    }, [blockingWordMode, blockingWords]);

    useEffect(() => {
        if (!detailStack.length) return;
        document.body.classList.add('drawer-open');
        const close = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            detailRequestController.current?.abort();
            detailRequestController.current = null;
            setDetailLoadingPid(null);
            setDetailStack([]);
        };
        document.addEventListener('keydown', close);
        return () => {
            document.body.classList.remove('drawer-open');
            document.removeEventListener('keydown', close);
        };
    }, [detailStack.length]);

    useEffect(() => {
        Promise.allSettled([fetchTags(), fetchBookmarks(), fetchPostingIdentities(), fetchBlockingWords()]).then(
            ([tagsResult, bookmarksResult, identitiesResult, blockingWordsResult]) => {
                if (tagsResult.status === 'fulfilled') setTags(tagsResult.value);
                if (bookmarksResult.status === 'fulfilled') setBookmarkGroups(bookmarksResult.value);
                if (identitiesResult.status === 'fulfilled') setPostingIdentities(identitiesResult.value);
                if (blockingWordsResult.status === 'fulfilled') setBlockingWords(blockingWordsResult.value);
            },
        );
        void refreshUnreadCount();
    }, [refreshUnreadCount]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === '/' && !/INPUT|TEXTAREA/.test((event.target as HTMLElement)?.tagName)) {
                event.preventDefault();
                searchRef.current?.focus();
            }
            if (event.key === 'Escape') {
                setBookmarkMenuPid(null);
                setMobileMenuOpen(false);
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    const fetchActiveFeedBatch = useCallback(
        async (signal: AbortSignal) => {
            const batch = await fetchNextFeedBatch({
                branches: feedBranches.current,
                pageSize: PAGE_SIZE,
                signal,
                pacing: feedRequestPacing.current,
                request: (keyword, branchPage, branchSignal) =>
                    fetchFeed({
                        mode,
                        page: branchPage,
                        limit: PAGE_SIZE,
                        keyword,
                        label: selectedLabel,
                        bookmarkId: selectedBookmark,
                        signal: branchSignal,
                    }),
            });
            const itemsByPid = new Map<number, Hole>();
            for (const { result } of batch.results) {
                for (const hole of result.items) itemsByPid.set(hole.pid, hole);
            }
            return {
                items: [...itemsByPid.values()].sort(
                    (left, right) => Number(right.timestamp) - Number(left.timestamp),
                ),
                total: batch.total,
                hasMore: batch.hasMore,
                failures: batch.failures,
                successfulBranches: batch.results.length,
            };
        },
        [mode, selectedBookmark, selectedLabel],
    );

    const loadFirstPage = useCallback(async () => {
        feedController.current?.abort();
        const controller = new AbortController();
        feedController.current = controller;
        loadingMoreRef.current = false;
        feedBranches.current = createFeedBranches(activeQuery.backendQueries);
        setLoading(true);
        setLoadingMore(false);
        setFeedError('');
        setHoles([]);
        setCandidateTotal(0);
        setPage(1);
        setHasMore(false);
        setBookmarkMenuPid(null);
        try {
            const result = await fetchActiveFeedBatch(controller.signal);
            if (!result.successfulBranches && result.failures.length) {
                throw new Error(describeFeedFailures(result.failures, true));
            }
            setHoles(result.items);
            setCandidateTotal(result.total);
            setHasMore(result.hasMore);
            setFeedError(describeFeedFailures(result.failures));
            setPage(1);
        } catch (nextError) {
            if ((nextError as Error).name !== 'AbortError') {
                setFeedError(nextError instanceof Error ? nextError.message : '信息流加载失败');
            }
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    }, [activeQuery.backendQueries, fetchActiveFeedBatch]);

    useEffect(() => {
        void loadFirstPage();
        return () => feedController.current?.abort();
    }, [loadFirstPage, refreshKey]);

    useEffect(() => {
        if (!toast) return;
        const timer = window.setTimeout(() => setToast(''), 2200);
        return () => window.clearTimeout(timer);
    }, [toast]);

    const visibleHoles = useMemo(() => {
        const matchingHoles = activeQuery.hasAdvanced
            ? holes.filter((hole) => matchesAdvancedQuery(hole.text, activeQuery))
            : holes;
        if (blockingWordMode !== 'hide' || !blockingWords.length) return matchingHoles;
        return matchingHoles.filter((hole) => !containsBlockingWord(hole, blockingWords));
    }, [activeQuery, blockingWordMode, blockingWords, holes]);

    const highlightTerms = useMemo(() => {
        const baseTerms = activeQuery.orQueries.flatMap((query) => query.replace(/^#(?=\d+$)/, '').split(/\s+/));
        return [...new Set([...baseTerms, ...activeQuery.includes].filter(Boolean))];
    }, [activeQuery]);

    const switchMode = (nextMode: FeedMode, bookmarkId?: number) => {
        setDocsOpen(false);
        setMode(nextMode);
        setSelectedBookmark(bookmarkId);
        setSelectedLabel(undefined);
        setQueryInput('');
        setActiveQuery(parseQuery(''));
        setSelectedHole(null);
        setDetailStack([]);
        setExpandedCommentPids(new Set());
        setCopyMenuPid(null);
        setMobileMenuOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const goHome = () => {
        switchMode('latest');
        setRefreshKey((key) => key + 1);
    };

    const openDocumentation = () => {
        setDocsOpen(true);
        setSelectedHole(null);
        setDetailStack([]);
        setExpandedCommentPids(new Set());
        setBookmarkMenuPid(null);
        setCopyMenuPid(null);
        setMobileMenuOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const activateSearch = (source: string) => {
        const normalizedSource = source.trim();
        setDocsOpen(false);
        setActiveQuery(parseQuery(normalizedSource));
        setSelectedHole(null);
        setDetailStack([]);
        setExpandedCommentPids(new Set());
        setCopyMenuPid(null);
        setSelectedBookmark(undefined);
        if (normalizedSource) {
            setRecentSearches((current) =>
                [normalizedSource, ...current.filter((item) => item !== normalizedSource)].slice(
                    0,
                    SEARCH_HISTORY_LIMIT,
                ),
            );
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        activateSearch(queryInput);
    };

    const selectRecentSearch = (source: string) => {
        setQueryInput(source);
        activateSearch(source);
    };

    const clearRecentSearches = () => setRecentSearches([]);

    const clearSearch = () => {
        setQueryInput('');
        setActiveQuery(parseQuery(''));
        searchRef.current?.focus();
    };

    const cycleTheme = () => {
        const systemIsDark = matchMedia('(prefers-color-scheme: dark)').matches;
        setThemeMode((current) => {
            if (current === 'system') return systemIsDark ? 'light' : 'dark';
            if (current === 'light') return systemIsDark ? 'dark' : 'system';
            return systemIsDark ? 'system' : 'light';
        });
    };

    const toggleCommentView = () => {
        setCommentViewMode((current) => {
            if (current === 'modal' && selectedHole) {
                setExpandedCommentPids((pids) => new Set(pids).add(selectedHole.pid));
                setSelectedHole(null);
            }
            return current === 'modal' ? 'inline' : 'modal';
        });
    };

    const openComments = (hole: Hole) => {
        if (commentViewMode === 'modal') {
            setSelectedHole(hole);
            return;
        }
        setExpandedCommentPids((current) => {
            const next = new Set(current);
            if (next.has(hole.pid)) next.delete(hole.pid);
            else next.add(hole.pid);
            return next;
        });
    };

    const closeInlineComments = (pid: number) => {
        setExpandedCommentPids((current) => {
            const next = new Set(current);
            next.delete(pid);
            return next;
        });
    };

    const closeHoleDetails = () => {
        detailRequestController.current?.abort();
        detailRequestController.current = null;
        setDetailLoadingPid(null);
        setDetailStack([]);
    };

    const goBackInHoleDetails = () => {
        detailRequestController.current?.abort();
        detailRequestController.current = null;
        setDetailLoadingPid(null);
        setDetailStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
    };

    const openReferencedPid = async (pid: number, source: Hole) => {
        if (!Number.isSafeInteger(pid) || pid <= 0 || pid === source.pid) return;
        detailRequestController.current?.abort();
        const controller = new AbortController();
        detailRequestController.current = controller;
        setSelectedHole(null);
        setDetailStack((current) => (current.length ? current : [source]));
        setDetailLoadingPid(pid);
        try {
            const target = await fetchHole(pid, controller.signal);
            if (controller.signal.aborted) return;
            setDetailStack((current) => {
                const base = current.length ? current : [source];
                return base.at(-1)?.pid === target.pid ? base : [...base, target];
            });
        } catch (nextError) {
            if ((nextError as Error).name !== 'AbortError') {
                setToast(nextError instanceof Error ? nextError.message : `无法打开 #${pid}`);
            }
        } finally {
            if (detailRequestController.current === controller) {
                detailRequestController.current = null;
                setDetailLoadingPid(null);
            }
        }
    };

    const openHoleDetails = async (pid: number) => {
        if (!Number.isSafeInteger(pid) || pid <= 0) return;
        detailRequestController.current?.abort();
        const controller = new AbortController();
        detailRequestController.current = controller;
        setSelectedHole(null);
        setDetailStack([]);
        setDetailLoadingPid(pid);
        try {
            const target = await fetchHole(pid, controller.signal);
            if (!controller.signal.aborted) setDetailStack([target]);
        } catch (nextError) {
            if ((nextError as Error).name !== 'AbortError') {
                setToast(nextError instanceof Error ? nextError.message : `无法打开 #${pid}`);
            }
        } finally {
            if (detailRequestController.current === controller) {
                detailRequestController.current = null;
                setDetailLoadingPid(null);
            }
        }
    };

    const loadMore = async () => {
        if (loadingMoreRef.current || !hasMore) return;
        loadingMoreRef.current = true;
        feedController.current?.abort();
        const controller = new AbortController();
        feedController.current = controller;
        setLoadingMore(true);
        setFeedError('');
        const nextPage = page + 1;
        try {
            const result = await fetchActiveFeedBatch(controller.signal);
            setHoles((current) => {
                const known = new Set(current.map((hole) => hole.pid));
                return [...current, ...result.items.filter((hole) => !known.has(hole.pid))].sort(
                    (left, right) => Number(right.timestamp) - Number(left.timestamp),
                );
            });
            setPage(nextPage);
            setHasMore(result.hasMore);
            setFeedError(describeFeedFailures(result.failures));
        } catch (nextError) {
            if ((nextError as Error).name !== 'AbortError') {
                setFeedError(nextError instanceof Error ? nextError.message : '加载更多失败');
            }
        } finally {
            loadingMoreRef.current = false;
            if (!controller.signal.aborted) setLoadingMore(false);
        }
    };

    loadMoreAction.current = () => void loadMore();

    useEffect(() => {
        const sentinel = feedSentinelRef.current;
        if (!sentinel || loading || loadingMore || !hasMore) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) loadMoreAction.current();
            },
            { rootMargin: '480px 0px' },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, loading, loadingMore, page, visibleHoles.length]);

    const updateHole = (pid: number, updater: (hole: Hole) => Hole) => {
        setHoles((current) => current.map((hole) => (hole.pid === pid ? updater(hole) : hole)));
        setSelectedHole((current) => (current?.pid === pid ? updater(current) : current));
        setDetailStack((current) => current.map((hole) => (hole.pid === pid ? updater(hole) : hole)));
    };

    const toggleBookmarkFor = async (hole: Hole, group: BookmarkGroup) => {
        const previousGroupId = hole.bookmark?.bookmark?.id ?? hole.attention_info?.bookmark_id;
        const remove = hole.is_follow === 1 && previousGroupId === group.id;
        setBookmarkBusy(true);
        try {
            await setBookmark(hole.pid, group.id, remove, hole.is_follow === 1);
            updateHole(hole.pid, (current) => ({
                ...current,
                is_follow: remove ? 0 : 1,
                bookmark: remove ? undefined : { bookmark: group },
                attention_info: {
                    ...current.attention_info,
                    bookmark_id: remove ? undefined : group.id,
                    bookmark_info: remove ? undefined : group,
                },
            }));
            setBookmarkGroups((current) =>
                current.map((item) => {
                    if (typeof item.hole_count !== 'number') return item;
                    if (item.id === previousGroupId && (remove || previousGroupId !== group.id)) {
                        return { ...item, hole_count: Math.max(0, item.hole_count - 1) };
                    }
                    if (!remove && item.id === group.id && previousGroupId !== group.id) {
                        return { ...item, hole_count: item.hole_count + 1 };
                    }
                    return item;
                }),
            );
            if (mode === 'bookmarks' && (remove || (selectedBookmark && selectedBookmark !== group.id))) {
                setHoles((current) => current.filter((item) => item.pid !== hole.pid));
            }
            setToast(remove ? '已移出收藏夹' : `已保存到「${group.bookmark_name}」`);
            setBookmarkMenuPid(null);
        } catch (nextError) {
            setToast(nextError instanceof Error ? nextError.message : '收藏操作失败');
        } finally {
            setBookmarkBusy(false);
        }
    };

    const toggleBookmarkDirect = async (hole: Hole) => {
        const remove = hole.is_follow === 1;
        const previousGroupId = hole.bookmark?.bookmark?.id ?? hole.attention_info?.bookmark_id;
        setBookmarkBusy(true);
        try {
            await setBookmark(hole.pid, undefined, remove, hole.is_follow === 1);
            updateHole(hole.pid, (current) => ({
                ...current,
                is_follow: remove ? 0 : 1,
                bookmark: undefined,
                attention_info: {
                    ...current.attention_info,
                    bookmark_id: undefined,
                    bookmark_info: undefined,
                },
            }));
            if (remove && previousGroupId !== undefined) {
                setBookmarkGroups((current) =>
                    current.map((item) =>
                        item.id === previousGroupId && typeof item.hole_count === 'number'
                            ? { ...item, hole_count: Math.max(0, item.hole_count - 1) }
                            : item,
                    ),
                );
            }
            if (mode === 'bookmarks' && remove) {
                setHoles((current) => current.filter((item) => item.pid !== hole.pid));
            }
            setToast(remove ? '已取消收藏' : '已收藏');
            setBookmarkMenuPid(null);
        } catch (nextError) {
            setToast(nextError instanceof Error ? nextError.message : '收藏操作失败');
        } finally {
            setBookmarkBusy(false);
        }
    };

    const createBookmarkFor = async (hole: Hole, name: string) => {
        setBookmarkBusy(true);
        try {
            const previousGroupId = hole.bookmark?.bookmark?.id ?? hole.attention_info?.bookmark_id;
            const group = await createBookmark(name);
            setBookmarkGroups((current) => [...current, { ...group, hole_count: 0 }]);
            await setBookmark(hole.pid, group.id, false, hole.is_follow === 1);
            updateHole(hole.pid, (current) => ({
                ...current,
                is_follow: 1,
                bookmark: { bookmark: group },
                attention_info: { ...current.attention_info, bookmark_id: group.id, bookmark_info: group },
            }));
            setBookmarkGroups((current) =>
                current.map((item) => {
                    if (item.id === group.id) return { ...item, hole_count: 1 };
                    if (item.id === previousGroupId && typeof item.hole_count === 'number') {
                        return { ...item, hole_count: Math.max(0, item.hole_count - 1) };
                    }
                    return item;
                }),
            );
            if (mode === 'bookmarks' && selectedBookmark && selectedBookmark !== group.id) {
                setHoles((current) => current.filter((item) => item.pid !== hole.pid));
            }
            setToast(`已创建并保存到「${name}」`);
            setBookmarkMenuPid(null);
        } catch (nextError) {
            setToast(nextError instanceof Error ? nextError.message : '创建收藏夹失败');
        } finally {
            setBookmarkBusy(false);
        }
    };

    const createEmptyBookmark = async (name: string) => {
        setBookmarkBusy(true);
        try {
            const group = await createBookmark(name);
            setBookmarkGroups((current) =>
                current.some((item) => item.id === group.id)
                    ? current
                    : [...current, { ...group, hole_count: group.hole_count ?? 0 }],
            );
            setToast(`已创建收藏夹「${name}」`);
            return true;
        } catch (nextError) {
            setToast(nextError instanceof Error ? nextError.message : '创建收藏夹失败');
            return false;
        } finally {
            setBookmarkBusy(false);
        }
    };

    const deleteBookmarkGroup = async () => {
        const group = bookmarkDeleteTarget;
        if (!group || bookmarkBusy) return;
        setBookmarkBusy(true);
        try {
            await deleteBookmark(group.id);
            setBookmarkGroups((current) => current.filter((item) => item.id !== group.id));
            setHoles((current) => current.map((hole) => withoutBookmarkGroup(hole, group.id)));
            setSelectedHole((current) => (current ? withoutBookmarkGroup(current, group.id) : current));
            setDetailStack((current) => current.map((hole) => withoutBookmarkGroup(hole, group.id)));
            setBookmarkDeleteTarget(null);
            if (selectedBookmark === group.id) {
                setSelectedBookmark(undefined);
                setRefreshKey((key) => key + 1);
            }
            setToast(`已删除收藏夹「${group.bookmark_name}」`);
        } catch (nextError) {
            setToast(nextError instanceof Error ? nextError.message : '删除收藏夹失败');
        } finally {
            setBookmarkBusy(false);
        }
    };

    const togglePraiseFor = async (hole: Hole) => {
        if (likingPids.has(hole.pid)) return;
        const wasPraised = hole.is_praise === 1;
        const currentCount = hole.praise_num_show ?? hole.praise_num ?? 0;
        const nextCount = Math.max(0, currentCount + (wasPraised ? -1 : 1));
        setLikingPids((current) => new Set(current).add(hole.pid));
        updateHole(hole.pid, (current) => ({
            ...current,
            is_praise: wasPraised ? 0 : 1,
            praise_num: nextCount,
            praise_num_show: nextCount,
        }));
        try {
            await toggleHolePraise(hole.pid);
        } catch (nextError) {
            updateHole(hole.pid, (current) => ({
                ...current,
                is_praise: hole.is_praise,
                praise_num: hole.praise_num,
                praise_num_show: hole.praise_num_show,
            }));
            setToast(nextError instanceof Error ? nextError.message : '点赞操作失败');
        } finally {
            setLikingPids((current) => {
                const next = new Set(current);
                next.delete(hole.pid);
                return next;
            });
        }
    };

    const copyHole = __ENABLE_COPY__
        ? async (hole: Hole, includeComments: boolean) => {
              try {
                  let output = `#${hole.pid} ${copyTime(hole.timestamp)} 关注数：${hole.likenum ?? 0} 回复数：${hole.reply ?? 0}\n${displayText(hole.text) || (hole.type === 'image' ? '[图片]' : '')}`;
                  if (includeComments && hole.reply > 0) {
                      setToast('正在整理正文和评论...');
                      const allComments: TreeholeComment[] = [];
                      let nextPage = 1;
                      let finalPage = 1;
                      do {
                          const result = await fetchComments(hole, nextPage, 'asc');
                          allComments.push(...result.items);
                          finalPage = result.lastPage;
                          nextPage += 1;
                      } while (nextPage <= finalPage);
                      output += `\n${allComments
                          .map((comment) => {
                              const sender = commentSender(comment);
                              return `#${comment.cid} ${copyTime(comment.timestamp)}\n[${sender}] ${displayText(comment.text) || (comment.media_ids ? '[图片]' : '')}`;
                          })
                          .join('\n')}`;
                  }
                  await writeClipboard(output);
                  setToast(includeComments ? '已复制正文和评论' : '已复制正文');
              } catch (nextError) {
                  setToast(nextError instanceof Error ? nextError.message : '复制失败');
              }
          }
        : undefined;

    const copyPid = async (pid: number) => {
        try {
            await writeClipboard(String(pid));
            setToast(`${pid} 洞号已复制`);
        } catch {
            setToast('复制洞号失败');
        }
    };

    const saveBlockingWords = async (words: string[], nextMode: BlockingWordMode) => {
        setBlockingWordsBusy(true);
        try {
            const normalizedWords = [...new Set(words.map((word) => word.trim()).filter(Boolean))];
            await updateBlockingWords(normalizedWords);
            setBlockingWords(normalizedWords);
            setBlockingWordMode(nextMode);
            setBlockingWordsOpen(false);
            setToast(nextMode === 'hide' ? '屏蔽词已更新，将彻底隐藏匹配内容' : '屏蔽词已更新，将折叠匹配内容');
        } catch (nextError) {
            setToast(nextError instanceof Error ? nextError.message : '屏蔽词更新失败');
        } finally {
            setBlockingWordsBusy(false);
        }
    };

    const handlePublished = (hole: Hole) => {
        setMode('latest');
        setSelectedBookmark(undefined);
        setSelectedLabel(undefined);
        setQueryInput('');
        setActiveQuery(parseQuery(''));
        setHoles((current) => [hole, ...current.filter((item) => item.pid !== hole.pid)]);
        setCandidateTotal((current) => current + 1);
    };

    const isSearching = Boolean(activeQuery.source || selectedLabel);
    const currentDetailHole = detailStack.at(-1) ?? null;

    return {
        mode,
        docsOpen,
        setDocsOpen,
        themeMode,
        commentViewMode,
        mobileMenuOpen,
        setMobileMenuOpen,
        queryInput,
        setQueryInput,
        recentSearches,
        activeQuery,
        selectedLabel,
        setSelectedLabel,
        selectedBookmark,
        tags,
        bookmarkGroups,
        blockingWords,
        blockingWordMode,
        postingIdentities,
        holes,
        page,
        hasMore,
        candidateTotal,
        loading,
        feedError,
        setRefreshKey,
        selectedHole,
        setSelectedHole,
        detailStack,
        detailLoadingPid,
        expandedCommentPids,
        bookmarkMenuPid,
        setBookmarkMenuPid,
        copyMenuPid,
        setCopyMenuPid,
        bookmarkBusy,
        bookmarkDeleteTarget,
        setBookmarkDeleteTarget,
        blockingWordsOpen,
        setBlockingWordsOpen,
        blockingWordsBusy,
        notificationsOpen,
        setNotificationsOpen,
        unreadNotifications,
        likingPids,
        toast,
        setToast,
        searchRef,
        feedSentinelRef,
        refreshUnreadCount,
        visibleHoles,
        highlightTerms,
        switchMode,
        goHome,
        openDocumentation,
        submitSearch,
        selectRecentSearch,
        clearRecentSearches,
        clearSearch,
        cycleTheme,
        toggleCommentView,
        openComments,
        closeInlineComments,
        closeHoleDetails,
        goBackInHoleDetails,
        openHoleDetails,
        openReferencedPid,
        loadFirstPage,
        updateHole,
        toggleBookmarkDirect,
        toggleBookmarkFor,
        createBookmarkFor,
        createEmptyBookmark,
        deleteBookmarkGroup,
        togglePraiseFor,
        copyHole,
        copyPid,
        saveBlockingWords,
        handlePublished,
        isSearching,
        currentDetailHole,
    };
}

export type AppController = ReturnType<typeof useAppController>;
