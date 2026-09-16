import { addMockComment, commentsForHole, mockBookmarks, mockHoles, mockTags, setMockBestAnswer } from './mock';
import { normalizeComment, resolveCommentTotal } from './normalize';
import type {
    BookmarkGroup,
    FeedMode,
    Hole,
    NotificationMessage,
    NotificationType,
    PageResult,
    PostingIdentity,
    PublishIdentityOptions,
    Tag,
    TagNode,
    TreeholeComment,
} from './types';

export const isDemo = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
const mockImageFiles = new Map<number, File>();
const mockMediaFiles = new Map<number, File>();

interface ApiEnvelope<T> {
    success?: boolean;
    code?: number;
    message?: string;
    data: T;
}

interface ApiPage<T> {
    data?: T[];
    list?: T[];
    total?: number;
    last_page?: number;
    current_page?: number;
}

export interface FeedRequest {
    mode: FeedMode;
    page: number;
    limit: number;
    keyword?: string;
    pid?: number;
    label?: number;
    bookmarkId?: number;
    signal?: AbortSignal;
}

function readCookie(name: string) {
    const prefix = `${encodeURIComponent(name)}=`;
    const item = document.cookie.split('; ').find((part) => part.startsWith(prefix));
    return item ? decodeURIComponent(item.slice(prefix.length)) : '';
}

export function getDeviceUuid() {
    let uuid = localStorage.getItem('pku-uuid');
    if (!uuid) {
        uuid = `Web_PKUHOLE_2.0.0_WEB_UUID_${crypto.randomUUID()}`;
        localStorage.setItem('pku-uuid', uuid);
    }
    return uuid;
}

function handleBusinessRedirect(code?: number) {
    const routes: Record<number, string> = {
        40002: '/verification',
        40008: '/verification_user',
        40088: '/verification_user?type=1',
        40009: '/verification_slide_h5?computer=1',
        40099: '/verification_slide_h5?type=1&computer=1',
        40010: '/agreement?computer=1',
    };
    if (code && routes[code]) {
        window.location.assign(routes[code]);
        throw new Error('正在前往安全验证');
    }
}

async function request<T>(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    const token = readCookie('pku_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    headers.set('Uuid', getDeviceUuid());
    if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');

    const response = await fetch(`/api${path}`, {
        ...init,
        headers,
        credentials: 'same-origin',
    });

    if (response.status === 401) {
        const error = new Error('登录状态已失效');
        error.name = 'AuthError';
        throw error;
    }
    if (!response.ok) throw new Error(`请求失败 (${response.status})`);

    const result = (await response.json()) as ApiEnvelope<T>;
    handleBusinessRedirect(result.code);
    if (result.success === false) throw new Error(result.message || '请求未成功');
    return result.data;
}

async function chapiRequest<T>(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    const token = localStorage.getItem('token') || readCookie('pku_token');
    const xsrfToken = readCookie('XSRF-TOKEN');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (xsrfToken) headers.set('X-XSRF-TOKEN', xsrfToken);
    headers.set('Uuid', getDeviceUuid());
    headers.set('userAgent', 'pku_web');
    if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');

    const response = await fetch(`/chapi${path}`, {
        ...init,
        headers,
        credentials: 'same-origin',
    });
    if (response.status === 401) {
        const error = new Error('登录状态已失效');
        error.name = 'AuthError';
        throw error;
    }
    if (!response.ok) throw new Error(`请求失败 (${response.status})`);

    const result = (await response.json()) as ApiEnvelope<T>;
    handleBusinessRedirect(result.code);
    if (result.success === false || (result.code && result.code !== 20000)) {
        throw new Error(result.message || '请求未成功');
    }
    return result.data;
}

function unwrapPage<T>(payload: ApiPage<T> | T[]): PageResult<T> {
    if (Array.isArray(payload)) return { items: payload, total: payload.length, lastPage: 1 };
    const items = Array.isArray(payload?.list) ? payload.list : Array.isArray(payload?.data) ? payload.data : [];
    return {
        items,
        total: Number(payload?.total ?? items.length),
        lastPage: Number(payload?.last_page ?? 1),
    };
}

function normalizeHole(hole: Hole): Hole {
    const bookmark =
        hole.bookmark ??
        (hole.attention_info?.bookmark_id && hole.attention_info.bookmark_info
            ? { bookmark: hole.attention_info.bookmark_info }
            : undefined);
    return {
        ...hole,
        kind: hole.kind === undefined ? undefined : Number(hole.kind),
        reward_cost: hole.reward_cost === undefined ? undefined : Number(hole.reward_cost),
        has_reward_good:
            hole.has_reward_good === undefined ? undefined : Number(hole.has_reward_good) === 1 ? 1 : 0,
        islz: hole.islz === undefined ? undefined : Number(hole.islz) === 1 ? 1 : 0,
        bookmark,
    };
}

function waitForDemo(signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, 280);
        signal?.addEventListener(
            'abort',
            () => {
                window.clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
        );
    });
}

export async function fetchFeed(options: FeedRequest): Promise<PageResult<Hole>> {
    if (isDemo) {
        await waitForDemo(options.signal);
        let items = [...mockHoles];
        if (options.mode === 'bookmarks') items = items.filter((hole) => hole.is_follow);
        if (options.mode === 'bounty') items = items.filter((hole) => hole.kind === 1);
        if (options.bookmarkId) {
            items = items.filter((hole) => hole.bookmark?.bookmark?.id === options.bookmarkId);
        }
        if (options.pid) items = items.filter((hole) => hole.pid === options.pid);
        if (options.keyword) {
            const keyword = options.keyword.replace(/^#/, '').toLocaleLowerCase();
            items = items.filter(
                (hole) => String(hole.pid).includes(keyword) || hole.text.toLocaleLowerCase().includes(keyword),
            );
        }
        if (options.label) items = items.filter((hole) => hole.label_info?.id === options.label);
        const start = (options.page - 1) * options.limit;
        return {
            items: items.slice(start, start + options.limit).map((hole) => ({
                ...hole,
                is_praise: hole.is_praise ?? 0,
                praise_num: hole.praise_num ?? hole.likenum,
                praise_num_show: hole.praise_num_show ?? hole.likenum,
            })),
            total: items.length,
            lastPage: Math.max(1, Math.ceil(items.length / options.limit)),
        };
    }

    if (options.pid) {
        const hole = await fetchHole(options.pid, options.signal);
        return { items: [hole], total: 1, lastPage: 1 };
    }

    const query = new URLSearchParams({
        page: String(options.page),
        limit: String(options.limit),
        comment_limit: '0',
        comment_stream: '1',
    });
    if (options.keyword) query.set('keyword', options.keyword);
    if (options.label) query.set('label', String(options.label));
    if (options.bookmarkId && options.mode === 'bookmarks') {
        query.set('bookmark_id', String(options.bookmarkId));
    }
    if (options.mode === 'bookmarks') query.set('is_follow', '1');
    if (options.mode === 'bounty') query.set('kind', '1');
    const payload = await chapiRequest<ApiPage<Hole>>(`/api/v3/hole/list_comments?${query}`, {
        signal: options.signal,
    });
    const page = unwrapPage(payload);
    const items = page.items.map(normalizeHole);
    const inferredLastPage = items.length < options.limit ? options.page : options.page + 1;
    const hasTotal = Number.isFinite(Number(payload.total));
    return {
        items,
        total: hasTotal
            ? Number(payload.total)
            : (options.page - 1) * options.limit + items.length + (items.length === options.limit ? 1 : 0),
        lastPage: payload.last_page ? Number(payload.last_page) : inferredLastPage,
    };
}

export async function fetchHole(pid: number, signal?: AbortSignal): Promise<Hole> {
    if (isDemo) {
        await waitForDemo(signal);
        const hole = mockHoles.find((item) => item.pid === pid);
        if (!hole) throw new Error(`没有找到 #${pid}`);
        return { ...hole };
    }
    const query = new URLSearchParams({ pid: String(pid), comment_stream: '1' });
    const payload = await chapiRequest<Hole | { hole?: Hole }>(`/api/v3/hole/one?${query}`, { signal });
    const hole = (payload as { hole?: Hole } | undefined)?.hole ?? (payload as Hole | undefined);
    if (!hole?.pid) throw new Error(`没有找到 #${pid}`);
    return normalizeHole(hole);
}

export async function fetchComments(
    hole: Hole,
    page: number,
    sort: 'asc' | 'desc',
    signal?: AbortSignal,
): Promise<PageResult<TreeholeComment>> {
    if (isDemo) {
        await waitForDemo(signal);
        const ordered = [...commentsForHole(hole)].sort((a, b) =>
            sort === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp,
        );
        const limit = 15;
        return {
            items: ordered.slice((page - 1) * limit, page * limit),
            total: ordered.length,
            lastPage: Math.max(1, Math.ceil(ordered.length / limit)),
        };
    }
    const limit = 15;
    const query = new URLSearchParams({
        pid: String(hole.pid),
        page: String(page),
        limit: String(limit),
        sort: sort === 'asc' ? '0' : '1',
        comment_stream: '1',
    });
    const payload = await chapiRequest<{ list?: TreeholeComment[] }>(`/api/v3/comment/list?${query}`, { signal });
    const items = (payload.list ?? []).map(normalizeComment);
    // This endpoint's `total` is the page size (usually 15), not the number of
    // comments. The post's `reply` field is the authoritative comment count.
    const total = resolveCommentTotal(hole.reply, page, limit, items.length);
    return { items, total, lastPage: Math.max(1, Math.ceil(total / limit)) };
}

export async function fetchPostingIdentities(): Promise<PostingIdentity[]> {
    if (isDemo) return [{ id: 4762, exclusive_id: 'Arthals', audit_status: 'approved' }];
    const payload = await chapiRequest<{ list?: PostingIdentity[] }>('/api/v3/exclusive_id/list');
    return (payload.list ?? []).filter((identity) => identity.audit_status === 'approved');
}

export async function authorizeIdentityLabels() {
    if (isDemo) return;
    await chapiRequest<unknown>('/api/v3/auth/baseinfo');
}

async function uploadMediaImage(file: File) {
    if (isDemo) {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        mockMediaFiles.set(id, file);
        return id;
    }
    const form = new FormData();
    form.set('data', file);
    const payload = await chapiRequest<{ id: number }>('/api/v3/media/uploadImage', {
        method: 'POST',
        body: form,
    });
    if (!payload?.id) throw new Error('图片上传失败');
    return payload.id;
}

export async function toggleHolePraise(pid: number) {
    if (isDemo) {
        await waitForDemo();
        return;
    }
    await chapiRequest<unknown>('/api/v3/hole/praise', {
        method: 'POST',
        body: JSON.stringify({ pid }),
    });
}

export async function fetchTags(): Promise<TagNode[]> {
    if (isDemo) return mockTags.map((tag) => ({ ...tag, children: tag.children?.map((child) => ({ ...child })) }));
    const payload = await chapiRequest<TagNode[] | { list?: TagNode[] }>('/api/v3/tags/tree');
    return Array.isArray(payload) ? payload : (payload.list ?? []);
}

export async function fetchBookmarks(): Promise<BookmarkGroup[]> {
    if (isDemo) return [...mockBookmarks];
    const payload = await chapiRequest<BookmarkGroup[] | { list?: BookmarkGroup[] }>(
        '/api/v3/bookmark/list?page=1&limit=60',
    );
    return Array.isArray(payload) ? payload : (payload.list ?? []);
}

export async function fetchBlockingWords(): Promise<string[]> {
    if (isDemo) {
        const stored = localStorage.getItem('treehole-art-blocking-words') ?? '';
        return stored
            .split('|')
            .map((word) => word.trim())
            .filter(Boolean);
    }
    const payload = await chapiRequest<{ keywords?: string }>('/api/v3/person_blocking_words/index');
    return String(payload?.keywords ?? '')
        .split('|')
        .map((word) => word.trim())
        .filter(Boolean);
}

export async function updateBlockingWords(words: string[]) {
    const normalized = [...new Set(words.map((word) => word.trim()).filter(Boolean))];
    if (isDemo) {
        localStorage.setItem('treehole-art-blocking-words', normalized.join('|'));
        await waitForDemo();
        return;
    }
    await chapiRequest<unknown>('/api/v3/person_blocking_words/store', {
        method: 'POST',
        body: JSON.stringify(normalized.length ? { keywords: normalized.join('|') } : { del: 1 }),
    });
}

const demoNotifications: Record<NotificationType, NotificationMessage[]> = {
    int_msg: [
        {
            id: 1,
            pid: 39403877,
            is_read: 0,
            body: {
                type: 5,
                cid: 81002,
                contents: '谢谢提醒。刚刚抬头，今晚的月亮也很好看。',
                created_at: Math.floor(Date.now() / 1000) - 5 * 60,
            },
            hole_info: { pid: 39403877, text: '在未名湖边看到了今年第一片变黄的叶子。' },
        },
    ],
    sys_msg: [
        {
            id: 2,
            type: 1,
            timestamp: Math.floor(Date.now() / 1000) - 2 * 3600,
            content: '欢迎使用Treehole-Art。',
            is_read: 0,
        },
    ],
};

export async function fetchNotifications(
    messageType: NotificationType,
    page = 1,
    limit = 10,
    signal?: AbortSignal,
): Promise<PageResult<NotificationMessage>> {
    if (isDemo) {
        await waitForDemo(signal);
        const messages = demoNotifications[messageType];
        const start = (page - 1) * limit;
        return {
            items: messages.slice(start, start + limit).map((message) => ({ ...message })),
            total: messages.length,
            lastPage: Math.max(1, Math.ceil(messages.length / limit)),
        };
    }
    const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        message_type: messageType,
    });
    return unwrapPage(await chapiRequest<ApiPage<NotificationMessage>>(`/api/v3/message/index?${query}`, { signal }));
}

export async function fetchUnreadNotificationCount(messageType: NotificationType): Promise<number> {
    if (isDemo) return demoNotifications[messageType].filter((message) => !message.is_read).length;
    const query = new URLSearchParams({ message_type: messageType });
    const payload = await chapiRequest<{ count?: number }>(`/api/v3/message/un_read?${query}`);
    return Number(payload?.count ?? 0);
}

export async function markNotificationsRead(messageType: NotificationType) {
    if (isDemo) {
        demoNotifications[messageType].forEach((message) => {
            message.is_read = 1;
        });
        return;
    }
    await chapiRequest<unknown>('/api/v3/message/set_read', {
        method: 'POST',
        body: JSON.stringify({ message_type: messageType }),
    });
}

export async function markNotificationRead(id: number) {
    if (isDemo) {
        const message = Object.values(demoNotifications)
            .flat()
            .find((item) => item.id === id);
        if (message) message.is_read = 1;
        return;
    }
    await chapiRequest<unknown>('/api/v3/message/setIntMsgReadByID', {
        method: 'POST',
        body: JSON.stringify({ id }),
    });
}

export async function createBookmark(name: string): Promise<BookmarkGroup> {
    if (isDemo) {
        const group = { id: Date.now(), bookmark_name: name, hole_count: 0 };
        mockBookmarks.push(group);
        return group;
    }
    const created = await chapiRequest<number | BookmarkGroup>('/api/v3/bookmark/add', {
        method: 'POST',
        body: JSON.stringify({ bookmark_name: name }),
    });
    if (typeof created === 'object' && created?.id) return created;
    if (Number.isSafeInteger(Number(created)) && Number(created) > 0) {
        return { id: Number(created), bookmark_name: name };
    }
    const groups = await fetchBookmarks();
    const group = [...groups].reverse().find((item) => item.bookmark_name === name);
    if (!group) throw new Error('收藏夹已创建，但未取得分组信息');
    return group;
}

export async function deleteBookmark(id: number) {
    if (isDemo) {
        await waitForDemo();
        const index = mockBookmarks.findIndex((group) => group.id === id);
        if (index >= 0) mockBookmarks.splice(index, 1);
        for (const hole of mockHoles) {
            const bookmarkId = hole.bookmark?.bookmark?.id ?? hole.attention_info?.bookmark_id;
            if (bookmarkId !== id) continue;
            hole.bookmark = undefined;
            hole.attention_info = {
                ...hole.attention_info,
                bookmark_id: undefined,
                bookmark_info: undefined,
            };
        }
        return;
    }
    await chapiRequest<unknown>('/api/v3/bookmark/del', {
        method: 'POST',
        body: JSON.stringify({ id }),
    });
}

export async function setBookmark(pid: number, bookmarkId?: number, remove = false, alreadyFollowed = false) {
    if (isDemo) {
        await waitForDemo();
        const hole = mockHoles.find((item) => item.pid === pid);
        const group = mockBookmarks.find((item) => item.id === bookmarkId);
        if (hole) {
            hole.is_follow = remove ? 0 : 1;
            hole.bookmark = remove || !group ? undefined : { bookmark: group };
            hole.attention_info = {
                ...hole.attention_info,
                bookmark_id: remove ? undefined : group?.id,
                bookmark_info: remove ? undefined : group,
            };
        }
        return;
    }
    if (remove) {
        await chapiRequest<unknown>('/api/v3/hole/attention_cancel', {
            method: 'POST',
            body: JSON.stringify({ pid: String(pid) }),
        });
        return;
    }
    if (!alreadyFollowed) {
        await chapiRequest<unknown>('/api/v3/hole/attention', {
            method: 'POST',
            body: JSON.stringify({ pid }),
        });
    }
    if (bookmarkId === undefined) return;
    await chapiRequest<unknown>('/api/v3/hole/attention_update', {
        method: 'POST',
        body: JSON.stringify({ pid, bookmark_id: bookmarkId }),
    });
}

export async function publishHole(
    text: string,
    label?: number,
    image?: File,
    identity: PublishIdentityOptions = { identityTypes: [] },
    rewardCost?: number,
): Promise<Hole> {
    if (rewardCost !== undefined && (!Number.isSafeInteger(rewardCost) || rewardCost < 1)) {
        throw new Error('悬赏树叶数必须是正整数');
    }
    if (isDemo) {
        await waitForDemo();
        const hole: Hole = {
            pid: Math.floor(40000000 + Math.random() * 9000000),
            text,
            type: image ? 'image' : 'text',
            kind: rewardCost === undefined ? 0 : 1,
            reward_cost: rewardCost,
            has_reward_good: rewardCost === undefined ? undefined : 0,
            islz: 1,
            timestamp: Math.floor(Date.now() / 1000),
            likenum: 0,
            reply: 0,
            is_follow: 0,
            is_praise: 0,
            praise_num: 0,
            praise_num_show: 0,
            label_info: mockTags.flatMap((tag) => tag.children ?? []).find((tag) => tag.id === label) as
                | Tag
                | undefined,
            exclusive_id_id: identity.exclusiveId,
            exclusive_id_info: identity.exclusiveId ? { exclusive_id: identity.exclusiveName } : undefined,
            identity_info: identity.identityTypes.length
                ? {
                      department: identity.identityTypes.includes(1) ? '信息科学技术学院' : undefined,
                      gender: identity.identityTypes.includes(2) ? '未设置' : undefined,
                      level: identity.identityTypes.includes(3) ? '学生' : undefined,
                  }
                : undefined,
        };
        mockHoles.unshift(hole);
        if (image) mockImageFiles.set(hole.pid, image);
        return hole;
    }

    const mediaId = image ? await uploadMediaImage(image) : undefined;
    const payload = {
        kind: rewardCost === undefined ? 0 : 1,
        type: image ? 'image' : 'text',
        text,
        tags_ids: label ? String(label) : '',
        media_ids: mediaId ? String(mediaId) : '',
        identity_show: identity.identityTypes.length ? 1 : 0,
        identity_type: identity.identityTypes.join(','),
        ...(rewardCost === undefined ? {} : { reward_cost: rewardCost }),
        ...(identity.exclusiveId ? { exclusive_id_id: identity.exclusiveId } : {}),
    };
    const created = await chapiRequest<number | Hole>('/api/v3/hole/post', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    if (typeof created === 'object' && created?.pid) {
        return normalizeHole({
            ...created,
            kind: created.kind ?? (rewardCost === undefined ? 0 : 1),
            reward_cost: created.reward_cost ?? rewardCost,
            has_reward_good: created.has_reward_good ?? (rewardCost === undefined ? undefined : 0),
            islz: created.islz ?? 1,
        });
    }
    const pid = Number(created);
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('发布成功，但未取得洞号');
    return {
        pid,
        text,
        type: image ? 'image' : 'text',
        kind: rewardCost === undefined ? 0 : 1,
        reward_cost: rewardCost,
        has_reward_good: rewardCost === undefined ? undefined : 0,
        islz: 1,
        timestamp: Math.floor(Date.now() / 1000),
        likenum: 0,
        praise_num: 0,
        praise_num_show: 0,
        is_praise: 0,
        reply: 0,
        is_follow: 0,
        label_info: undefined,
        media_ids: mediaId ? String(mediaId) : undefined,
        exclusive_id_id: identity.exclusiveId,
        exclusive_id_info: identity.exclusiveId ? { exclusive_id: identity.exclusiveName } : undefined,
    };
}

export async function setBestAnswer(cid: number): Promise<void> {
    if (isDemo) {
        await waitForDemo();
        if (!setMockBestAnswer(cid)) throw new Error('没有找到这条评论');
        return;
    }
    await chapiRequest<unknown>('/api/v3/comment/good', {
        method: 'POST',
        body: JSON.stringify({ cid }),
    });
}

export async function publishComment(
    pid: number,
    text: string,
    replyTo?: TreeholeComment,
    image?: File,
    identity: PublishIdentityOptions = { identityTypes: [] },
): Promise<TreeholeComment> {
    if (isDemo) {
        await waitForDemo();
        const mediaId = image ? await uploadMediaImage(image) : undefined;
        const comment: TreeholeComment = {
            cid: Date.now(),
            pid,
            text,
            name: 'You',
            timestamp: Math.floor(Date.now() / 1000),
            likenum: 0,
            is_lz: mockHoles.find((hole) => hole.pid === pid)?.islz === 1 ? 1 : 0,
            quote: replyTo ? { name_tag: replyTo.name || '洞友', text: replyTo.text } : undefined,
            media_ids: mediaId ? String(mediaId) : undefined,
            exclusive_id_id: identity.exclusiveId,
            exclusive_id_info: identity.exclusiveId ? { exclusive_id: identity.exclusiveName } : undefined,
            identity_info: identity.identityTypes.length
                ? {
                      department: identity.identityTypes.includes(1) ? '信息科学技术学院' : undefined,
                      gender: identity.identityTypes.includes(2) ? '未设置' : undefined,
                      level: identity.identityTypes.includes(3) ? '学生' : undefined,
                  }
                : undefined,
        };
        addMockComment(comment);
        return comment;
    }
    const mediaId = image ? await uploadMediaImage(image) : undefined;
    const created = await chapiRequest<number | TreeholeComment>('/api/v3/comment/post', {
        method: 'POST',
        body: JSON.stringify({
            pid,
            text,
            media_ids: mediaId ? String(mediaId) : '',
            identity_show: identity.identityTypes.length ? 1 : 0,
            identity_type: identity.identityTypes.join(','),
            ...(replyTo ? { comment_id: replyTo.cid } : {}),
            ...(identity.exclusiveId ? { exclusive_id_id: identity.exclusiveId } : {}),
        }),
    });
    if (typeof created === 'object' && created?.cid) {
        return normalizeComment(created);
    }
    const cid = Number(created);
    if (Number.isSafeInteger(cid) && cid > 0) {
        try {
            const comment = await chapiRequest<TreeholeComment>(`/api/v3/comment/get?cid=${cid}`);
            return normalizeComment(comment);
        } catch {
            // The post succeeded; keep the new reply visible even if detail refresh fails.
        }
    }
    return {
        cid: Number.isSafeInteger(cid) && cid > 0 ? cid : Date.now(),
        pid,
        text,
        name: identity.exclusiveName || 'You',
        name_tag: identity.exclusiveName || 'You',
        timestamp: Math.floor(Date.now() / 1000),
        likenum: 0,
        quote: replyTo ? { name_tag: replyTo.name || replyTo.name_tag || '洞友', text: replyTo.text } : undefined,
        media_ids: mediaId ? String(mediaId) : undefined,
        exclusive_id_id: identity.exclusiveId,
        exclusive_id_info: identity.exclusiveId ? { exclusive_id: identity.exclusiveName } : undefined,
    };
}

export async function prepareUploadImage(file: File, maxBytes = 716800): Promise<File> {
    if (!/[\/]jpe?g$|[\/]png$|[\/]gif$/i.test(file.type)) throw new Error('仅支持 JPG、JPEG、PNG 或 GIF 图片');
    if (file.size <= maxBytes) return file;
    if (file.type.toLocaleLowerCase() === 'image/gif')
        throw new Error(`GIF 图片不能超过 ${Math.round(maxBytes / 1024)} KB`);

    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, Math.sqrt(maxBytes / file.size) * 0.94, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    const toBlob = (quality: number) =>
        new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('图片压缩失败'))), 'image/jpeg', quality);
        });
    let width = Math.max(1, Math.round(bitmap.width * ratio));
    let height = Math.max(1, Math.round(bitmap.height * ratio));
    let blob: Blob | undefined;

    for (let attempt = 0; attempt < 5; attempt += 1) {
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('图片处理失败');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, width, height);
        context.drawImage(bitmap, 0, 0, width, height);
        blob = await toBlob(Math.max(0.58, 0.86 - attempt * 0.07));
        if (blob.size <= maxBytes) break;
        const reduction = Math.min(0.88, Math.sqrt(maxBytes / blob.size) * 0.92);
        width = Math.max(1, Math.round(width * reduction));
        height = Math.max(1, Math.round(height * reduction));
    }
    bitmap.close();
    if (!blob || blob.size > maxBytes) throw new Error('图片压缩后仍超过 700 KB');
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
}

export async function fetchCommentImage(mediaId: number, signal?: AbortSignal, original = false) {
    if (isDemo) {
        const file = mockMediaFiles.get(mediaId);
        return file ? URL.createObjectURL(file) : '';
    }
    const headers = new Headers();
    const token = localStorage.getItem('token') || readCookie('pku_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    headers.set('Uuid', getDeviceUuid());
    headers.set('userAgent', 'pku_web');
    const endpoint = original ? 'getMediaBinary' : 'getThumbnail';
    const response = await fetch(`/chapi/api/v3/media/${endpoint}?id=${mediaId}`, {
        headers,
        credentials: 'same-origin',
        signal,
    });
    if (!response.ok) return '';
    return URL.createObjectURL(await response.blob());
}

export async function fetchHoleImage(pid: number, signal?: AbortSignal) {
    if (isDemo) {
        const file = mockImageFiles.get(pid);
        return file ? URL.createObjectURL(file) : '';
    }
    const headers = new Headers();
    const token = readCookie('pku_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    headers.set('Uuid', getDeviceUuid());
    const response = await fetch(`/api/pku_image/${pid}`, {
        headers,
        credentials: 'same-origin',
        signal,
    });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return '';
    return URL.createObjectURL(await response.blob());
}
