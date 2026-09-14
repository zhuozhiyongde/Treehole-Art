import {
    AddRegular,
    ArrowLeftRegular,
    BookmarkRegular,
    CheckRegular,
    CloseRegular,
    ComputerRegular,
    Copy2Regular,
    Delete2Regular,
    DownSmallRegular,
    Filter3Regular,
    FolderRegular,
    HashtagRegular,
    HeartRegular,
    Home4Regular,
    InformationRegular,
    LayoutBottomOpenRegular,
    Loading3Regular,
    MenuRegular,
    Message3Regular,
    MoonRegular,
    NotificationRegular,
    PicRegular,
    Refresh3Regular,
    Search2Regular,
    SendRegular,
    ShieldRegular,
    SunRegular,
    User4Regular,
    WindowsRegular,
} from '@mingcute/react/core-regular';
import { BookmarkFilled, HeartFilled, Message3Filled } from '@mingcute/react/core-filled';
import type { CSSProperties, FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    createBookmark,
    authorizeIdentityLabels,
    deleteBookmark,
    fetchBlockingWords,
    fetchBookmarks,
    fetchCommentImage,
    fetchComments,
    fetchFeed,
    fetchHole,
    fetchHoleImage,
    fetchNotifications,
    fetchPostingIdentities,
    fetchTags,
    fetchUnreadNotificationCount,
    getDeviceUuid,
    isDemo,
    prepareUploadImage,
    publishComment,
    publishHole,
    markNotificationRead,
    markNotificationsRead,
    setBookmark,
    toggleHolePraise,
    updateBlockingWords,
} from './api';
import { matchesAdvancedQuery, parseQuery, type ParsedQuery } from './search';
import { displayText } from './normalize';
import { commentColorIndex, commentColorToken } from './commentColors';
import type {
    BookmarkGroup,
    FeedMode,
    Hole,
    NotificationMessage,
    NotificationType,
    PostingIdentity,
    PublishIdentityOptions,
    TagNode,
    ThemeMode,
    TreeholeComment,
} from './types';

const PAGE_SIZE = 8;
const PKU_LOGO_URL = 'https://cdn.arthals.ink/css/src/PKU.svg';
type CommentViewMode = 'modal' | 'inline';

function tagTone(id?: number) {
    return `tag-tone-${Math.abs(id ?? 0) % 5}`;
}

function commentColor(name = '洞友') {
    const normalizedName = displayText(name) || '洞友';
    return commentColorToken(commentColorIndex(normalizedName));
}

function withoutBookmarkGroup(hole: Hole, bookmarkId: number): Hole {
    const currentId = hole.bookmark?.bookmark?.id ?? hole.attention_info?.bookmark_id;
    if (currentId !== bookmarkId) return hole;
    return {
        ...hole,
        bookmark: undefined,
        attention_info: {
            ...hole.attention_info,
            bookmark_id: undefined,
            bookmark_info: undefined,
        },
    };
}

async function writeClipboard(text: string) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
}

function IconButton({
    label,
    children,
    className = '',
    ...props
}: {
    label: string;
    children: ReactNode;
    className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button type="button" className={`icon-button ${className}`} aria-label={label} data-tooltip={label} {...props}>
            {children}
        </button>
    );
}

const IDENTITY_LABELS = [
    { id: 1, label: '二级单位' },
    { id: 2, label: '性别' },
    { id: 3, label: '类别' },
];

function PostingIdentityControls({
    identities,
    exclusiveId,
    identityTypes,
    onExclusiveIdChange,
    onIdentityTypesChange,
    onNotice,
    compact = false,
}: {
    identities: PostingIdentity[];
    exclusiveId?: number;
    identityTypes: number[];
    onExclusiveIdChange: (id?: number) => void;
    onIdentityTypesChange: (types: number[]) => void;
    onNotice: (message: string) => void;
    compact?: boolean;
}) {
    const toggleIdentityLabels = async (checked: boolean) => {
        if (!checked) {
            onIdentityTypesChange([]);
            return;
        }
        try {
            await authorizeIdentityLabels();
            onIdentityTypesChange([1, 2, 3]);
        } catch (error) {
            onNotice(error instanceof Error ? error.message : '身份标签授权失败');
        }
    };

    return (
        <div className={`posting-identity ${compact ? 'compact' : ''}`}>
            <label className="identity-select">
                <User4Regular size={16} />
                <select
                    value={exclusiveId ?? 0}
                    aria-label="发布身份"
                    onChange={(event) => {
                        const value = Number(event.target.value);
                        onExclusiveIdChange(value || undefined);
                        if (value) onIdentityTypesChange([]);
                    }}>
                    <option value={0}>匿名发布</option>
                    {identities.map((identity) => (
                        <option value={identity.id} key={identity.id}>
                            {identity.exclusive_id}
                        </option>
                    ))}
                </select>
            </label>
            <label className="identity-toggle" title={exclusiveId ? '使用昵称时不能展示身份标签' : '展示身份标签'}>
                <input
                    type="checkbox"
                    checked={identityTypes.length > 0}
                    disabled={Boolean(exclusiveId)}
                    onChange={(event) => void toggleIdentityLabels(event.target.checked)}
                />
                <span>身份标签</span>
            </label>
            {!exclusiveId && identityTypes.length > 0 && (
                <div className="identity-types" aria-label="选择身份标签">
                    {IDENTITY_LABELS.map((item) => (
                        <label key={item.id}>
                            <input
                                type="checkbox"
                                checked={identityTypes.includes(item.id)}
                                onChange={(event) =>
                                    onIdentityTypesChange(
                                        event.target.checked
                                            ? [...identityTypes, item.id].sort()
                                            : identityTypes.filter((id) => id !== item.id),
                                    )
                                }
                            />
                            <span>{item.label}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

function IdentityBadges({ item }: { item: Hole | TreeholeComment }) {
    const nickname = item.exclusive_id_info?.exclusive_id;
    const labels = [item.identity_info?.department, item.identity_info?.gender, item.identity_info?.level].filter(
        Boolean,
    ) as string[];
    if (!nickname && !labels.length) return null;
    return (
        <span className="identity-badges">
            {nickname && <span className="nickname-badge">{nickname}</span>}
            {labels.map((label) => (
                <span key={label}>{label}</span>
            ))}
        </span>
    );
}

function commentSender(comment: TreeholeComment) {
    return displayText(comment.name || comment.name_tag) || '洞友';
}

function formatTime(timestamp: number) {
    const seconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp));
    if (seconds < 60) return '刚刚';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
    if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)} 天前`;
    return fullTime(timestamp);
}

function fullTime(timestamp: number) {
    const date = new Date(timestamp * 1000);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function copyTime(timestamp: number) {
    const date = new Date(timestamp * 1000);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function messageTimestamp(value?: number | string) {
    if (typeof value === 'number') return value > 1e12 ? Math.floor(value / 1000) : value;
    if (!value) return 0;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric > 1e12 ? Math.floor(numeric / 1000) : numeric;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
}

function notificationHole(message: NotificationMessage) {
    const info = Array.isArray(message.hole_info) ? message.hole_info[0] : message.hole_info;
    return info?.pid ? info : undefined;
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedText({ text, terms = [] }: { text: unknown; terms?: string[] }) {
    const safeText = displayText(text);
    const usefulTerms = [...new Set(terms.map((term) => term.trim()).filter(Boolean))].sort(
        (left, right) => right.length - left.length,
    );
    if (!usefulTerms.length) return safeText;
    const pattern = new RegExp(`(${usefulTerms.map(escapeRegExp).join('|')})`, 'giu');
    return safeText.split(pattern).map((piece, index) =>
        usefulTerms.some((term) => term.toLocaleLowerCase() === piece.toLocaleLowerCase()) ? (
            <mark className="search-highlight" key={`${piece}-${index}`}>
                {piece}
            </mark>
        ) : (
            piece
        ),
    );
}

function RichText({
    text,
    onPid,
    highlightTerms = [],
}: {
    text: unknown;
    onPid?: (pid: number) => void;
    highlightTerms?: string[];
}) {
    const pieces = displayText(text).split(/(https?:\/\/[^\s]+|#?\d{5,})/g);
    return (
        <>
            {pieces.map((piece, index) => {
                if (/^https?:\/\//.test(piece)) {
                    return (
                        <a
                            key={`${piece}-${index}`}
                            href={piece}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}>
                            <HighlightedText text={piece} terms={highlightTerms} />
                        </a>
                    );
                }
                const pidMatch = piece.match(/^#?(\d{5,})$/);
                if (pidMatch) {
                    return (
                        <button
                            type="button"
                            className="inline-pid"
                            key={`${piece}-${index}`}
                            onClick={(event) => {
                                event.stopPropagation();
                                onPid?.(Number(pidMatch[1]));
                            }}>
                            <HighlightedText text={piece} terms={highlightTerms} />
                        </button>
                    );
                }
                return <HighlightedText text={piece} terms={highlightTerms} key={`text-${index}`} />;
            })}
        </>
    );
}

function ExpandableRichText({
    text,
    onPid,
    highlightTerms = [],
    className,
    collapsedLines,
}: {
    text: unknown;
    onPid?: (pid: number) => void;
    highlightTerms?: string[];
    className: string;
    collapsedLines: number;
}) {
    const [expanded, setExpanded] = useState(false);
    const [overflowing, setOverflowing] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const safeText = displayText(text);

    useLayoutEffect(() => {
        setExpanded(false);
        const content = contentRef.current;
        if (!content) return;
        const measure = () => {
            const lineHeight = Number.parseFloat(getComputedStyle(content).lineHeight);
            setOverflowing(Number.isFinite(lineHeight) && content.scrollHeight > lineHeight * collapsedLines + 1);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(content);
        return () => observer.disconnect();
    }, [collapsedLines, safeText]);

    return (
        <div className={`expandable-rich-text ${overflowing ? 'has-overflow' : ''} ${expanded ? 'expanded' : ''}`}>
            <div
                ref={contentRef}
                className={`${className} expandable-rich-text-content`}
                style={{ '--collapsed-lines': collapsedLines } as CSSProperties}>
                <RichText text={safeText} onPid={onPid} highlightTerms={highlightTerms} />
            </div>
            {overflowing && (
                <button
                    type="button"
                    className="expand-text-button"
                    aria-expanded={expanded}
                    onClick={(event) => {
                        event.stopPropagation();
                        setExpanded((current) => !current);
                    }}>
                    {expanded ? '收起' : '展开全文'}
                </button>
            )}
        </div>
    );
}

function referencedPidFor(hole: Hole) {
    const explicitPid = Number(hole.children_pid);
    if (Number.isSafeInteger(explicitPid) && explicitPid > 0 && explicitPid !== hole.pid) return explicitPid;
    const mentionPid = Number(String(hole.mention ?? '').split(',')[0]);
    if (Number.isSafeInteger(mentionPid) && mentionPid > 0 && mentionPid !== hole.pid) return mentionPid;
    const match = hole.text.match(/(?:^|[^\d])#?(\d{5,})(?!\d)/);
    const inferredPid = Number(match?.[1]);
    return Number.isSafeInteger(inferredPid) && inferredPid !== hole.pid ? inferredPid : undefined;
}

function PostImage({ pid }: { pid: number }) {
    const [url, setUrl] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        let objectUrl = '';
        fetchHoleImage(pid, controller.signal)
            .then((nextUrl) => {
                objectUrl = nextUrl;
                setUrl(nextUrl);
            })
            .catch(() => undefined);
        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [pid]);
    return url ? <img className="post-image" src={url} alt={`洞 ${pid} 的配图`} /> : null;
}

function MediaImage({ mediaId, className, alt }: { mediaId: number; className: string; alt: string }) {
    const [url, setUrl] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        let objectUrl = '';
        fetchCommentImage(mediaId, controller.signal)
            .then((nextUrl) => {
                objectUrl = nextUrl;
                setUrl(nextUrl);
            })
            .catch(() => undefined);
        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [mediaId]);
    return url ? <img className={className} src={url} alt={alt} /> : null;
}

function MediaImages({ mediaIds, variant }: { mediaIds?: string; variant: 'post' | 'comment' }) {
    const ids = String(mediaIds ?? '')
        .split(',')
        .map(Number)
        .filter((id) => Number.isSafeInteger(id) && id > 0);
    if (!ids.length) return null;
    return (
        <div className={`${variant}-media-list`}>
            {ids.map((id, index) => (
                <MediaImage
                    mediaId={id}
                    className={variant === 'post' ? 'post-image' : 'comment-image'}
                    alt={variant === 'post' ? `树洞配图 ${index + 1}` : `评论配图 ${index + 1}`}
                    key={id}
                />
            ))}
        </div>
    );
}

function QuotedHole({
    pid,
    initialHole,
    onOpen,
    onPid,
    highlightTerms,
    blockingWords,
    onCopyPid,
}: {
    pid: number;
    initialHole?: Hole;
    onOpen: (pid: number) => void;
    onPid: (pid: number) => void;
    highlightTerms: string[];
    blockingWords: string[];
    onCopyPid: (pid: number) => void;
}) {
    const [hole, setHole] = useState<Hole | undefined>(initialHole);
    const [showBlockedContent, setShowBlockedContent] = useState(false);
    const blockedWord = hole && blockingWords.find((word) => displayText(hole.text).includes(word));

    useEffect(() => {
        if (initialHole?.pid === pid) {
            setHole(initialHole);
            return;
        }
        const controller = new AbortController();
        setHole(undefined);
        fetchHole(pid, controller.signal)
            .then(setHole)
            .catch(() => undefined);
        return () => controller.abort();
    }, [initialHole, pid]);

    useEffect(() => setShowBlockedContent(false), [blockedWord, pid]);

    if (!hole) return null;
    return (
        <aside
            className="quoted-hole"
            aria-label={`打开引用树洞 ${hole.pid}`}
            role="button"
            tabIndex={0}
            onClick={(event) => {
                event.stopPropagation();
                onOpen(hole.pid);
            }}
            onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                onOpen(hole.pid);
            }}>
            <div className="quoted-hole-meta">
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onCopyPid(hole.pid);
                    }}
                    title="复制洞号">
                    #{hole.pid}
                </button>
                <time title={fullTime(hole.timestamp)}>{formatTime(hole.timestamp)}</time>
            </div>
            {blockedWord && !showBlockedContent ? (
                <div className="blocked-content quoted-blocked" onClick={(event) => event.stopPropagation()}>
                    <ShieldRegular size={16} />
                    <span>引用内容包含屏蔽词「{blockedWord}」</span>
                    <button type="button" onClick={() => setShowBlockedContent(true)}>
                        查看原文
                    </button>
                </div>
            ) : (
                <>
                    <ExpandableRichText
                        text={hole.text}
                        onPid={onPid}
                        highlightTerms={highlightTerms}
                        className="quoted-hole-text"
                        collapsedLines={5}
                    />
                    {hole.type === 'image' && <PostImage pid={hole.pid} />}
                </>
            )}
        </aside>
    );
}

function LoadingRows() {
    return (
        <div className="skeleton-list" aria-label="正在加载">
            {[0, 1, 2].map((item) => (
                <div className="skeleton-row" key={item}>
                    <span className="skeleton-line short" />
                    <span className="skeleton-line" />
                    <span className="skeleton-line medium" />
                </div>
            ))}
        </div>
    );
}

function EmptyState({ mode, searching, message }: { mode: FeedMode; searching: boolean; message?: string }) {
    return (
        <div className="empty-state">
            <div className="empty-icon">{searching ? <Search2Regular size={22} /> : <BookmarkRegular size={22} />}</div>
            <strong>
                {message || (searching ? '没有匹配的树洞' : mode === 'bookmarks' ? '收藏夹还是空的' : '暂时没有内容')}
            </strong>
            {!message && <span>{searching ? '换一组条件再试试' : '稍后刷新看看'}</span>}
        </div>
    );
}

function tagName(tag: TagNode) {
    return tag.tag_name || tag.name || `标签 ${tag.id}`;
}

function flattenTagLeaves(tags: TagNode[]): TagNode[] {
    return tags.flatMap((tag) => (tag.children?.length ? flattenTagLeaves(tag.children) : [tag]));
}

interface TagGroup {
    id: number;
    name: string;
    options: TagNode[];
}

function buildTagGroups(tags: TagNode[]): TagGroup[] {
    if (!tags.length) return [];
    if (!tags.some((tag) => tag.children?.length)) {
        return [{ id: -1, name: '标签', options: tags }];
    }
    return tags.map((tag) => ({
        id: tag.id,
        name: tagName(tag),
        options: tag.children?.length ? flattenTagLeaves(tag.children) : [tag],
    }));
}

function TagPicker({
    tags,
    value,
    onChange,
    icon,
    placeholder,
    emptyLabel,
    ariaLabel,
    className = '',
}: {
    tags: TagNode[];
    value?: number;
    onChange: (value?: number) => void;
    icon: ReactNode;
    placeholder: string;
    emptyLabel: string;
    ariaLabel: string;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [activeGroupId, setActiveGroupId] = useState<number>();
    const rootRef = useRef<HTMLDivElement>(null);
    const groups = useMemo(() => buildTagGroups(tags), [tags]);
    const selectedTag = useMemo(() => flattenTagLeaves(tags).find((tag) => tag.id === value), [tags, value]);
    const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0];

    const toggle = () => {
        setOpen((current) => {
            if (!current) {
                const selectedGroup = groups.find((group) => group.options.some((tag) => tag.id === value));
                setActiveGroupId(selectedGroup?.id ?? groups[0]?.id);
            }
            return !current;
        });
    };

    useEffect(() => {
        if (!open) return;
        const closeWhenOutside = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const closeWithEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('pointerdown', closeWhenOutside);
        document.addEventListener('keydown', closeWithEscape);
        return () => {
            document.removeEventListener('pointerdown', closeWhenOutside);
            document.removeEventListener('keydown', closeWithEscape);
        };
    }, [open]);

    const choose = (nextValue?: number) => {
        onChange(nextValue);
        setOpen(false);
    };

    return (
        <div className={`tag-picker ${className}`} ref={rootRef}>
            <button
                type="button"
                className="tag-picker-trigger"
                aria-label={ariaLabel}
                aria-expanded={open}
                onClick={(event) => {
                    event.stopPropagation();
                    toggle();
                }}>
                {icon}
                <span>{selectedTag?.tag_name || placeholder}</span>
            </button>
            {open && (
                <div className="popover tag-picker-popover tag-cascade" onClick={(event) => event.stopPropagation()}>
                    <div
                        className="tag-cascade-column tag-cascade-groups"
                        role="listbox"
                        aria-label={`${ariaLabel}分类`}>
                        <button
                            type="button"
                            className={`tag-cascade-empty ${!value ? 'active' : ''}`}
                            onClick={() => choose(undefined)}>
                            <span>{emptyLabel}</span>
                            {!value && <CheckRegular size={15} />}
                        </button>
                        {groups.map((group) => (
                            <button
                                type="button"
                                className={`tag-cascade-group ${activeGroup?.id === group.id ? 'active' : ''}`}
                                aria-selected={activeGroup?.id === group.id}
                                onClick={() => setActiveGroupId(group.id)}
                                onFocus={() => setActiveGroupId(group.id)}
                                onMouseEnter={() => setActiveGroupId(group.id)}
                                key={group.id}>
                                <span>{group.name}</span>
                                <i aria-hidden="true" />
                            </button>
                        ))}
                    </div>
                    <div className="tag-cascade-column tag-cascade-options" role="listbox" aria-label={ariaLabel}>
                        {activeGroup?.options.map((tag) => (
                            <button
                                type="button"
                                className={value === tag.id ? 'active' : ''}
                                onClick={() => choose(tag.id)}
                                key={tag.id}>
                                <span>{tagName(tag)}</span>
                                {value === tag.id && <CheckRegular size={15} />}
                            </button>
                        ))}
                        {!activeGroup?.options.length && <span className="tag-picker-empty">此分类暂无标签</span>}
                    </div>
                </div>
            )}
        </div>
    );
}

function SideTagMenu({
    tags,
    value,
    onChange,
}: {
    tags: TagNode[];
    value?: number;
    onChange: (value?: number) => void;
}) {
    const groups = useMemo(() => buildTagGroups(tags), [tags]);
    const [openGroupId, setOpenGroupId] = useState<number>();
    const [position, setPosition] = useState({ top: -1000, left: -1000 });
    const rootRef = useRef<HTMLDivElement>(null);
    const submenuRef = useRef<HTMLDivElement>(null);
    const groupRefs = useRef(new Map<number, HTMLButtonElement>());
    const openGroup = groups.find((group) => group.id === openGroupId);
    const selectedGroup = groups.find((group) => group.options.some((tag) => tag.id === value));

    const placeSubmenu = useCallback(() => {
        if (openGroupId === undefined) return;
        const anchor = groupRefs.current.get(openGroupId);
        if (!anchor) return;
        const anchorRect = anchor.getBoundingClientRect();
        const panelWidth = submenuRef.current?.offsetWidth ?? 210;
        const panelHeight = submenuRef.current?.offsetHeight ?? 240;
        setPosition({
            top: Math.max(8, Math.min(anchorRect.top, window.innerHeight - panelHeight - 8)),
            left: Math.max(8, anchorRect.left - panelWidth - 8),
        });
    }, [openGroupId]);

    useLayoutEffect(() => {
        placeSubmenu();
    }, [openGroup?.options.length, placeSubmenu]);

    useEffect(() => {
        if (openGroupId === undefined) return;
        const closeWhenOutside = (event: PointerEvent) => {
            const target = event.target as Node;
            if (!rootRef.current?.contains(target) && !submenuRef.current?.contains(target)) setOpenGroupId(undefined);
        };
        const closeWithEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpenGroupId(undefined);
        };
        document.addEventListener('pointerdown', closeWhenOutside);
        document.addEventListener('keydown', closeWithEscape);
        window.addEventListener('resize', placeSubmenu);
        window.addEventListener('scroll', placeSubmenu, true);
        return () => {
            document.removeEventListener('pointerdown', closeWhenOutside);
            document.removeEventListener('keydown', closeWithEscape);
            window.removeEventListener('resize', placeSubmenu);
            window.removeEventListener('scroll', placeSubmenu, true);
        };
    }, [openGroupId, placeSubmenu]);

    const choose = (nextValue?: number) => {
        onChange(nextValue);
        setOpenGroupId(undefined);
    };

    const portalHost = document.getElementById('treehole-art-root') ?? document.getElementById('root') ?? document.body;

    return (
        <div className="side-tag-menu" ref={rootRef}>
            <div className="side-options side-tag-groups" role="listbox" aria-label="标签分类">
                <button type="button" className={!value ? 'active' : ''} onClick={() => choose(undefined)}>
                    <span>全部内容</span>
                    {!value && <CheckRegular size={15} />}
                </button>
                {groups.map((group) => (
                    <button
                        type="button"
                        className={`${selectedGroup?.id === group.id ? 'active' : ''} ${openGroupId === group.id ? 'open' : ''}`}
                        aria-expanded={openGroupId === group.id}
                        aria-haspopup="listbox"
                        onClick={() => setOpenGroupId(group.id)}
                        onFocus={() => setOpenGroupId(group.id)}
                        onMouseEnter={() => setOpenGroupId(group.id)}
                        ref={(node) => {
                            if (node) groupRefs.current.set(group.id, node);
                            else groupRefs.current.delete(group.id);
                        }}
                        key={group.id}>
                        <span>{group.name}</span>
                        <i aria-hidden="true" />
                    </button>
                ))}
            </div>
            {openGroup &&
                createPortal(
                    <div
                        className="popover side-tag-submenu"
                        style={{ top: position.top, left: position.left }}
                        ref={submenuRef}
                        onClick={(event) => event.stopPropagation()}>
                        <div className="side-tag-submenu-title">{openGroup.name}</div>
                        <div role="listbox" aria-label={`${openGroup.name}标签`}>
                            {openGroup.options.map((tag) => (
                                <button
                                    type="button"
                                    className={value === tag.id ? 'active' : ''}
                                    onClick={() => choose(tag.id)}
                                    key={tag.id}>
                                    <span>{tagName(tag)}</span>
                                    {value === tag.id && <CheckRegular size={15} />}
                                </button>
                            ))}
                            {!openGroup.options.length && <span className="side-empty">此分类暂无标签</span>}
                        </div>
                    </div>,
                    portalHost,
                )}
        </div>
    );
}

function Composer({
    tags,
    identities,
    onPublished,
    onNotice,
}: {
    tags: TagNode[];
    identities: PostingIdentity[];
    onPublished: (hole: Hole) => void;
    onNotice: (message: string) => void;
}) {
    const [text, setText] = useState('');
    const [label, setLabel] = useState<number | undefined>();
    const [image, setImage] = useState<File | undefined>();
    const [exclusiveId, setExclusiveId] = useState<number | undefined>();
    const [identityTypes, setIdentityTypes] = useState<number[]>([]);
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const previewUrl = useMemo(() => (image ? URL.createObjectURL(image) : ''), [image]);

    useEffect(
        () => () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        },
        [previewUrl],
    );

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const trimmed = text.trim();
        if ((!trimmed && !image) || busy) return;
        setBusy(true);
        try {
            const upload = image ? await prepareUploadImage(image, 1024 * 1024) : undefined;
            const identity: PublishIdentityOptions = {
                exclusiveId,
                exclusiveName: identities.find((item) => item.id === exclusiveId)?.exclusive_id,
                identityTypes,
            };
            const hole = await publishHole(trimmed, label, upload, identity);
            onPublished(hole);
            setText('');
            setLabel(undefined);
            setImage(undefined);
            setExclusiveId(undefined);
            setIdentityTypes([]);
            onNotice('发布成功');
        } catch (nextError) {
            onNotice(nextError instanceof Error ? nextError.message : '发布失败');
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="composer" onSubmit={submit}>
            <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                onInput={(event) => {
                    event.currentTarget.style.height = 'auto';
                    event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 180)}px`;
                }}
                placeholder="分享此刻的想法..."
                aria-label="树洞内容"
                maxLength={5000}
                rows={2}
            />
            {image && (
                <div className="composer-attachment">
                    <img src={previewUrl} alt="待发布图片预览" />
                    <span>{image.name}</span>
                    <IconButton label="移除图片" onClick={() => setImage(undefined)}>
                        <Delete2Regular size={16} />
                    </IconButton>
                </div>
            )}
            <div className="composer-footer">
                <div className="composer-tools">
                    <TagPicker
                        tags={tags}
                        value={label}
                        onChange={setLabel}
                        icon={<HashtagRegular size={19} />}
                        placeholder="标签"
                        emptyLabel="不添加标签"
                        ariaLabel="发布标签"
                        className="composer-tag-picker"
                    />
                    <button
                        type="button"
                        className="composer-tool"
                        title="添加图片"
                        onClick={() => inputRef.current?.click()}>
                        <PicRegular size={19} />
                        <span>图片</span>
                    </button>
                    <input
                        ref={inputRef}
                        className="visually-hidden"
                        type="file"
                        accept="image/jpeg,image/png,image/gif"
                        onChange={(event) => setImage(event.target.files?.[0])}
                    />
                    <PostingIdentityControls
                        identities={identities}
                        exclusiveId={exclusiveId}
                        identityTypes={identityTypes}
                        onExclusiveIdChange={setExclusiveId}
                        onIdentityTypesChange={setIdentityTypes}
                        onNotice={onNotice}
                    />
                </div>
                <div className="composer-submit-area">
                    {text.length > 0 && <span>{text.length}/5000</span>}
                    <button type="submit" className="primary-button" disabled={busy || (!text.trim() && !image)}>
                        {busy ? <Loading3Regular className="spin" size={16} /> : <SendRegular size={16} />}
                        发布
                    </button>
                </div>
            </div>
        </form>
    );
}

function BookmarkMenu({
    hole,
    groups,
    busy,
    onSelect,
    onCreate,
}: {
    hole: Hole;
    groups: BookmarkGroup[];
    busy: boolean;
    onSelect: (group: BookmarkGroup) => void;
    onCreate: (name: string) => void;
}) {
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const currentId = hole.bookmark?.bookmark?.id ?? hole.attention_info?.bookmark_id;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        onCreate(trimmed);
        setName('');
        setCreating(false);
    };

    return (
        <div className="popover bookmark-popover" role="menu" onClick={(event) => event.stopPropagation()}>
            <div className="popover-title">保存到</div>
            <div className="bookmark-options">
                {groups.map((group) => (
                    <button
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={currentId === group.id}
                        key={group.id}
                        disabled={busy}
                        onClick={() => onSelect(group)}>
                        <span>{group.bookmark_name}</span>
                        {currentId === group.id && <CheckRegular size={16} />}
                    </button>
                ))}
            </div>
            {creating ? (
                <form className="new-bookmark-form" onSubmit={submit}>
                    <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="收藏夹名称"
                        maxLength={24}
                        autoFocus
                    />
                    <button type="submit" className="small-primary" disabled={busy || !name.trim()}>
                        创建
                    </button>
                </form>
            ) : (
                <button type="button" className="create-bookmark" onClick={() => setCreating(true)}>
                    <AddRegular size={16} />
                    新建收藏夹
                </button>
            )}
        </div>
    );
}

function HoleRow({
    hole,
    bookmarkOpen,
    copyOpen,
    bookmarkGroups,
    bookmarkBusy,
    praiseBusy,
    onOpenComments,
    onOpenBookmarkMenu,
    onToggleBookmarkDirect,
    onOpenCopyMenu,
    onToggleBookmark,
    onCreateBookmark,
    onCopy,
    onTogglePraise,
    onCopyPid,
    onOpenReferencedHole,
    highlightTerms,
    blockingWords,
}: {
    hole: Hole;
    bookmarkOpen: boolean;
    copyOpen: boolean;
    bookmarkGroups: BookmarkGroup[];
    bookmarkBusy: boolean;
    praiseBusy: boolean;
    onOpenComments: () => void;
    onOpenBookmarkMenu: () => void;
    onToggleBookmarkDirect: () => void;
    onOpenCopyMenu: () => void;
    onToggleBookmark: (group: BookmarkGroup) => void;
    onCreateBookmark: (name: string) => void;
    onCopy: (includeComments: boolean) => void;
    onTogglePraise: () => void;
    onCopyPid: (pid: number) => void;
    onOpenReferencedHole: (pid: number) => void;
    highlightTerms: string[];
    blockingWords: string[];
}) {
    const blockedWord = blockingWords.find((word) => displayText(hole.text).includes(word));
    const [showBlockedContent, setShowBlockedContent] = useState(false);
    useEffect(() => setShowBlockedContent(false), [blockedWord, hole.pid]);
    const openCopyMenu = (event: ReactMouseEvent) => {
        event.stopPropagation();
        if (event.altKey) onCopy(true);
        else onOpenCopyMenu();
    };

    const tag = hole.label_info?.tag_name || hole.tag;
    const tone = tagTone(hole.label_info?.id ?? hole.pid);
    const referencedPid = referencedPidFor(hole);
    const praiseCount = hole.praise_num_show ?? hole.praise_num ?? 0;

    return (
        <article className="hole-row" onClick={onOpenComments}>
            <div className="hole-meta">
                <button
                    type="button"
                    className="pid"
                    onClick={(event) => {
                        event.stopPropagation();
                        onCopyPid(hole.pid);
                    }}
                    title="复制洞号">
                    #{hole.pid}
                </button>
                <span className="meta-dot" />
                <time title={fullTime(hole.timestamp)}>{formatTime(hole.timestamp)}</time>
                {hole.is_top === 1 && <span className="badge badge-strong">置顶</span>}
                {tag && <span className={`badge tag-badge ${tone}`}>{tag}</span>}
            </div>
            <IdentityBadges item={hole} />
            {blockedWord && !showBlockedContent ? (
                <div className="blocked-content" onClick={(event) => event.stopPropagation()}>
                    <ShieldRegular size={18} />
                    <span>内容包含屏蔽词「{blockedWord}」</span>
                    <button type="button" onClick={() => setShowBlockedContent(true)}>
                        查看原文
                    </button>
                </div>
            ) : (
                <>
                    <ExpandableRichText
                        text={hole.text}
                        onPid={onOpenReferencedHole}
                        highlightTerms={highlightTerms}
                        className="hole-text"
                        collapsedLines={8}
                    />
                    {hole.type === 'image' &&
                        (hole.media_ids ? (
                            <MediaImages mediaIds={hole.media_ids} variant="post" />
                        ) : (
                            <PostImage pid={hole.pid} />
                        ))}
                    {referencedPid && (
                        <QuotedHole
                            pid={referencedPid}
                            initialHole={hole.children ?? hole.mentionInfo}
                            onOpen={onOpenReferencedHole}
                            onPid={onOpenReferencedHole}
                            highlightTerms={highlightTerms}
                            blockingWords={blockingWords}
                            onCopyPid={onCopyPid}
                        />
                    )}
                </>
            )}
            <div className="hole-actions">
                <button
                    type="button"
                    className={hole.reply > 0 ? 'has-comments' : ''}
                    onClick={(event) => {
                        event.stopPropagation();
                        onOpenComments();
                    }}>
                    {hole.reply > 0 ? <Message3Filled size={17} /> : <Message3Regular size={17} />}
                    <span>{hole.reply ? `${hole.reply} 条评论` : '评论'}</span>
                </button>
                <div className="bookmark-anchor">
                    <button
                        type="button"
                        className={`bookmark-main ${hole.is_follow ? 'is-active' : ''}`}
                        aria-label={hole.is_follow ? '取消收藏' : '收藏'}
                        aria-pressed={hole.is_follow === 1}
                        disabled={bookmarkBusy}
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggleBookmarkDirect();
                        }}>
                        {hole.is_follow ? <BookmarkFilled size={17} /> : <BookmarkRegular size={17} />}
                        <span>{hole.is_follow ? '已收藏' : '收藏'}</span>
                    </button>
                    <button
                        type="button"
                        className="bookmark-menu-trigger"
                        aria-label="选择收藏夹"
                        aria-expanded={bookmarkOpen}
                        disabled={bookmarkBusy}
                        onClick={(event) => {
                            event.stopPropagation();
                            onOpenBookmarkMenu();
                        }}>
                        <DownSmallRegular size={14} />
                    </button>
                    {bookmarkOpen && (
                        <BookmarkMenu
                            hole={hole}
                            groups={bookmarkGroups}
                            busy={bookmarkBusy}
                            onSelect={onToggleBookmark}
                            onCreate={onCreateBookmark}
                        />
                    )}
                </div>
                <button
                    type="button"
                    className={`praise-button ${hole.is_praise ? 'is-active' : ''}`}
                    aria-label={hole.is_praise ? '取消点赞' : '点赞'}
                    aria-pressed={hole.is_praise === 1}
                    disabled={praiseBusy}
                    onClick={(event) => {
                        event.stopPropagation();
                        onTogglePraise();
                    }}>
                    {hole.is_praise ? <HeartFilled size={16} /> : <HeartRegular size={16} />}
                    <span>{praiseCount}</span>
                </button>
                <div className="copy-anchor">
                    <button
                        type="button"
                        className="copy-hole"
                        aria-expanded={copyOpen}
                        onClick={openCopyMenu}
                        title="选择复制范围；桌面端可按 Alt/Option 点击直接复制正文和评论">
                        <Copy2Regular size={16} />
                        <span>复制</span>
                    </button>
                    {copyOpen && (
                        <div className="popover copy-popover" role="menu" onClick={(event) => event.stopPropagation()}>
                            <button type="button" role="menuitem" onClick={() => onCopy(false)}>
                                <Copy2Regular size={16} />
                                <span>
                                    <strong>复制正文</strong>
                                    <small>洞号、时间与正文</small>
                                </span>
                            </button>
                            <button type="button" role="menuitem" onClick={() => onCopy(true)}>
                                <Message3Regular size={16} />
                                <span>
                                    <strong>正文和评论</strong>
                                    <small>移动端也可直接选择</small>
                                </span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </article>
    );
}

function CommentRow({
    comment,
    filtered,
    onAuthorClick,
    onReply,
    onPid,
}: {
    comment: TreeholeComment;
    filtered: boolean;
    onAuthorClick: (comment: TreeholeComment) => void;
    onReply: (comment: TreeholeComment) => void;
    onPid: (pid: number) => void;
}) {
    const color = commentColor(commentSender(comment));
    const quoteColor = comment.quote ? commentColor(comment.quote.name_tag) : color;
    const sender = commentSender(comment);
    return (
        <article
            className="comment-row"
            style={{ '--comment-color': color, '--quote-color': quoteColor } as CSSProperties}
            tabIndex={0}
            aria-label={`回复 ${sender}`}
            onClick={() => onReply(comment)}
            onKeyDown={(event) => {
                if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
                event.preventDefault();
                onReply(comment);
            }}>
            <div className="comment-main">
                <div className="comment-heading">
                    <button
                        type="button"
                        className={`comment-author ${filtered ? 'active' : ''}`}
                        aria-pressed={filtered}
                        title={filtered ? `取消只看 ${sender}` : `只看 ${sender}`}
                        onClick={(event) => {
                            event.stopPropagation();
                            onAuthorClick(comment);
                        }}>
                        {sender}
                    </button>
                    <time title={fullTime(comment.timestamp)}>{formatTime(comment.timestamp)}</time>
                    <IdentityBadges item={comment} />
                </div>
                {comment.quote?.name_tag && (
                    <div className="quote">
                        <span>{comment.quote.name_tag}</span>
                        <RichText text={comment.quote.text} onPid={onPid} />
                    </div>
                )}
                {comment.text && (
                    <p>
                        <RichText text={comment.text} onPid={onPid} />
                    </p>
                )}
                <MediaImages mediaIds={comment.media_ids} variant="comment" />
            </div>
        </article>
    );
}

function CommentsPanel({
    hole,
    displayMode,
    identities,
    onClose,
    showClose = true,
    onCommentPublished,
    onNotice,
    onPid,
}: {
    hole: Hole;
    displayMode: CommentViewMode;
    identities: PostingIdentity[];
    onClose: () => void;
    showClose?: boolean;
    onCommentPublished: () => void;
    onNotice: (message: string) => void;
    onPid: (pid: number) => void;
}) {
    const [sort, setSort] = useState<'asc' | 'desc'>('asc');
    const [comments, setComments] = useState<TreeholeComment[]>([]);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(hole.reply);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [commentText, setCommentText] = useState('');
    const [commentImage, setCommentImage] = useState<File | undefined>();
    const [exclusiveId, setExclusiveId] = useState<number | undefined>();
    const [identityTypes, setIdentityTypes] = useState<number[]>([]);
    const [publishing, setPublishing] = useState(false);
    const [authorFilter, setAuthorFilter] = useState<string | null>(null);
    const [replyTarget, setReplyTarget] = useState<TreeholeComment | null>(null);
    const requestController = useRef<AbortController | null>(null);
    const commentInputRef = useRef<HTMLTextAreaElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const previewUrl = useMemo(() => (commentImage ? URL.createObjectURL(commentImage) : ''), [commentImage]);

    useEffect(
        () => () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        },
        [previewUrl],
    );

    useEffect(() => {
        if (displayMode !== 'modal') return;
        document.body.classList.add('drawer-open');
        const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onCloseRef.current();
        document.addEventListener('keydown', onKeyDown);
        return () => {
            requestController.current?.abort();
            document.body.classList.remove('drawer-open');
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [displayMode]);

    useEffect(() => {
        requestController.current?.abort();
        const controller = new AbortController();
        requestController.current = controller;
        setLoading(true);
        setError('');
        setPage(1);
        fetchComments(hole, 1, sort, controller.signal)
            .then((result) => {
                setComments(result.items);
                setTotal(result.total);
                setLastPage(result.lastPage);
            })
            .catch((nextError: Error) => {
                if (nextError.name !== 'AbortError') setError(nextError.message);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [hole.pid, sort]);

    useEffect(() => {
        setAuthorFilter(null);
        setReplyTarget(null);
    }, [hole.pid]);

    const visibleComments = useMemo(() => {
        if (!authorFilter) return comments;
        return comments.filter((comment) => commentSender(comment) === authorFilter);
    }, [authorFilter, comments]);

    const handleAuthorClick = (comment: TreeholeComment) => {
        const sender = commentSender(comment);
        setAuthorFilter((current) => (current === sender ? null : sender));
    };

    const handleReply = (comment: TreeholeComment) => {
        setReplyTarget(comment);
        window.requestAnimationFrame(() => commentInputRef.current?.focus());
    };

    const loadMore = async () => {
        const nextPage = page + 1;
        requestController.current?.abort();
        const controller = new AbortController();
        requestController.current = controller;
        setLoadingMore(true);
        try {
            const result = await fetchComments(hole, nextPage, sort, controller.signal);
            setComments((current) => {
                const known = new Set(current.map((comment) => comment.cid));
                return [...current, ...result.items.filter((comment) => !known.has(comment.cid))];
            });
            setPage(nextPage);
            setLastPage(result.lastPage);
        } catch (nextError) {
            if ((nextError as Error).name !== 'AbortError') {
                setError(nextError instanceof Error ? nextError.message : '评论加载失败');
            }
        } finally {
            if (!controller.signal.aborted) setLoadingMore(false);
        }
    };

    const submitComment = async (event: FormEvent) => {
        event.preventDefault();
        const text = commentText.trim();
        if ((!text && !commentImage) || publishing) return;
        setPublishing(true);
        try {
            const upload = commentImage ? await prepareUploadImage(commentImage, 1024 * 1024) : undefined;
            const identity: PublishIdentityOptions = {
                exclusiveId,
                exclusiveName: identities.find((item) => item.id === exclusiveId)?.exclusive_id,
                identityTypes,
            };
            const comment = await publishComment(hole.pid, text, replyTarget ?? undefined, upload, identity);
            setComments((current) => (sort === 'asc' ? [...current, comment] : [comment, ...current]));
            setTotal((current) => current + 1);
            setCommentText('');
            setCommentImage(undefined);
            setExclusiveId(undefined);
            setIdentityTypes([]);
            setReplyTarget(null);
            setAuthorFilter(null);
            onCommentPublished();
            onNotice('评论已发布');
        } catch (nextError) {
            onNotice(nextError instanceof Error ? nextError.message : '评论发布失败');
        } finally {
            setPublishing(false);
        }
    };

    const discussion = (
        <>
            <header className={`drawer-header ${showClose ? '' : 'without-close'}`}>
                <h2 id={`comments-title-${hole.pid}`}>
                    {total} 条评论
                    {authorFilter && (
                        <span>
                            {' '}
                            · {authorFilter} {visibleComments.length} 条
                        </span>
                    )}
                </h2>
                <div className="comment-header-actions">
                    <button
                        type="button"
                        className={`owner-filter ${authorFilter === '洞主' ? 'active' : ''}`}
                        aria-pressed={authorFilter === '洞主'}
                        onClick={() => {
                            setAuthorFilter((current) => (current === '洞主' ? null : '洞主'));
                            setReplyTarget(null);
                        }}>
                        只看洞主
                    </button>
                    <div className="segmented" aria-label="评论排序">
                        <button type="button" className={sort === 'asc' ? 'active' : ''} onClick={() => setSort('asc')}>
                            默认
                        </button>
                        <button
                            type="button"
                            className={sort === 'desc' ? 'active' : ''}
                            onClick={() => setSort('desc')}>
                            最新
                        </button>
                    </div>
                </div>
                {showClose && (
                    <IconButton
                        label="关闭评论"
                        className="drawer-close"
                        onClick={onClose}
                        autoFocus={displayMode === 'modal'}>
                        <CloseRegular size={20} />
                    </IconButton>
                )}
            </header>
            <div className="comments-scroll">
                {loading ? (
                    <LoadingRows />
                ) : error ? (
                    <div className="inline-error">
                        <InformationRegular size={18} />
                        {error}
                    </div>
                ) : comments.length ? (
                    <>
                        {visibleComments.length ? (
                            visibleComments.map((comment) => (
                                <CommentRow
                                    key={comment.cid}
                                    comment={comment}
                                    filtered={authorFilter === commentSender(comment)}
                                    onAuthorClick={handleAuthorClick}
                                    onReply={handleReply}
                                    onPid={onPid}
                                />
                            ))
                        ) : (
                            <EmptyState
                                mode="latest"
                                searching
                                message={`暂时没有 ${authorFilter || '该用户'} 的回复`}
                            />
                        )}
                        {page < lastPage && (
                            <button type="button" className="load-comments" onClick={loadMore} disabled={loadingMore}>
                                {loadingMore && <Loading3Regular className="spin" size={16} />}
                                查看更多评论
                            </button>
                        )}
                    </>
                ) : (
                    <EmptyState mode="latest" searching={false} message="还没有评论" />
                )}
            </div>
        </>
    );

    const composer = (
        <form className="comment-composer" onSubmit={submitComment}>
            {replyTarget && (
                <div className="reply-target">
                    <span>回复 [{commentSender(replyTarget)}]</span>
                    <IconButton label="取消回复" onClick={() => setReplyTarget(null)}>
                        <CloseRegular size={14} />
                    </IconButton>
                </div>
            )}
            {commentImage && (
                <div className="comment-attachment">
                    <img src={previewUrl} alt="待发布评论图片预览" />
                    <span>{commentImage.name}</span>
                    <IconButton label="移除图片" onClick={() => setCommentImage(undefined)}>
                        <Delete2Regular size={15} />
                    </IconButton>
                </div>
            )}
            <div className="comment-editor">
                <textarea
                    ref={commentInputRef}
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    onInput={(event) => {
                        event.currentTarget.style.height = '38px';
                        event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 100)}px`;
                    }}
                    placeholder={replyTarget ? `回复 ${commentSender(replyTarget)}` : '理性发言，友善互动'}
                    aria-label="评论内容"
                    maxLength={1000}
                    rows={1}
                />
                <IconButton
                    label="添加评论图片"
                    className="comment-image-picker"
                    onClick={() => imageInputRef.current?.click()}>
                    <PicRegular size={17} />
                </IconButton>
            </div>
            <button
                type="submit"
                className="primary-button"
                disabled={publishing || (!commentText.trim() && !commentImage)}>
                {publishing ? <Loading3Regular className="spin" size={16} /> : '发布'}
            </button>
            <div className="comment-options">
                <PostingIdentityControls
                    identities={identities}
                    exclusiveId={exclusiveId}
                    identityTypes={identityTypes}
                    onExclusiveIdChange={setExclusiveId}
                    onIdentityTypesChange={setIdentityTypes}
                    onNotice={onNotice}
                    compact
                />
            </div>
            <input
                ref={imageInputRef}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/gif"
                onChange={(event) => {
                    setCommentImage(event.target.files?.[0]);
                    event.currentTarget.value = '';
                }}
            />
        </form>
    );

    if (displayMode === 'inline') {
        return (
            <section className="comments-inline" aria-labelledby={`comments-title-${hole.pid}`}>
                {composer}
                {discussion}
            </section>
        );
    }

    return (
        <div className="drawer-layer" role="dialog" aria-modal="true" aria-labelledby={`comments-title-${hole.pid}`}>
            <button type="button" className="drawer-scrim" aria-label="关闭评论" onClick={onClose} />
            <aside className={`comments-drawer ${!loading && !error && !comments.length ? 'is-empty' : ''}`}>
                {discussion}
                {composer}
            </aside>
        </div>
    );
}

function SideBookmarkMenu({
    groups,
    active,
    selectedId,
    onSelect,
    onCreate,
    onRequestDelete,
    busy,
}: {
    groups: BookmarkGroup[];
    active: boolean;
    selectedId?: number;
    onSelect: (id?: number) => void;
    onCreate: (name: string) => Promise<boolean>;
    onRequestDelete: (group: BookmarkGroup) => void;
    busy: boolean;
}) {
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed || busy) return;
        if (await onCreate(trimmed)) {
            setName('');
            setCreating(false);
        }
    };

    return (
        <div className="side-options side-bookmarks" role="listbox" aria-label="收藏夹">
            <button type="button" className={active && !selectedId ? 'active' : ''} onClick={() => onSelect(undefined)}>
                <span>全部收藏</span>
                {active && !selectedId && <CheckRegular size={15} />}
            </button>
            {creating ? (
                <form className="side-bookmark-form" onSubmit={(event) => void submit(event)}>
                    <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="收藏夹名称"
                        aria-label="收藏夹名称"
                        maxLength={24}
                        autoFocus
                    />
                    <button
                        type="button"
                        aria-label="取消新建收藏夹"
                        onClick={() => {
                            setCreating(false);
                            setName('');
                        }}>
                        <CloseRegular size={14} />
                    </button>
                    <button type="submit" aria-label="创建收藏夹" disabled={busy || !name.trim()}>
                        {busy ? <Loading3Regular className="spin" size={14} /> : <CheckRegular size={14} />}
                    </button>
                </form>
            ) : (
                <button type="button" className="side-bookmark-create" onClick={() => setCreating(true)}>
                    <span>
                        <AddRegular size={15} />
                        新建收藏夹
                    </span>
                </button>
            )}
            {groups.map((group) => (
                <div className="side-bookmark-row" key={group.id}>
                    <button
                        type="button"
                        className={`side-bookmark-select ${active && selectedId === group.id ? 'active' : ''}`}
                        onClick={() => onSelect(group.id)}>
                        <span>
                            <FolderRegular size={15} />
                            {group.bookmark_name}
                        </span>
                        {typeof group.hole_count === 'number' && <small>{group.hole_count}</small>}
                    </button>
                    <IconButton
                        label={`删除收藏夹 ${group.bookmark_name}`}
                        className="side-bookmark-delete"
                        disabled={busy}
                        onClick={(event) => {
                            event.stopPropagation();
                            onRequestDelete(group);
                        }}>
                        <Delete2Regular size={14} />
                    </IconButton>
                </div>
            ))}
            {!groups.length && !creating && <span className="side-empty">还没有收藏夹</span>}
        </div>
    );
}

function BookmarkDeleteDialog({
    target,
    busy,
    onClose,
    onConfirm,
}: {
    target: BookmarkGroup | null;
    busy: boolean;
    onClose: () => void;
    onConfirm: () => void;
}) {
    useEffect(() => {
        if (!target) return;
        const close = (event: KeyboardEvent) => event.key === 'Escape' && !busy && onClose();
        document.addEventListener('keydown', close);
        return () => document.removeEventListener('keydown', close);
    }, [busy, onClose, target]);

    if (!target) return null;

    return (
        <div
            className="drawer-layer settings-layer"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-bookmark-title"
            aria-describedby="delete-bookmark-description">
            <button
                type="button"
                className="drawer-scrim"
                aria-label="取消删除收藏夹"
                onClick={busy ? undefined : onClose}
            />
            <section className="settings-dialog confirmation-dialog">
                <header>
                    <div>
                        <h2 id="delete-bookmark-title">删除收藏夹</h2>
                    </div>
                    <IconButton label="取消删除收藏夹" disabled={busy} onClick={onClose}>
                        <CloseRegular size={19} />
                    </IconButton>
                </header>
                <div className="confirmation-content" id="delete-bookmark-description">
                    确定删除「{target.bookmark_name}」吗？此操作无法撤销。
                </div>
                <footer>
                    <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>
                        取消
                    </button>
                    <button type="button" className="danger-button" disabled={busy} onClick={onConfirm}>
                        {busy && <Loading3Regular className="spin" size={15} />}
                        删除
                    </button>
                </footer>
            </section>
        </div>
    );
}

function BlockingWordsDialog({
    open,
    words,
    busy,
    onClose,
    onSave,
}: {
    open: boolean;
    words: string[];
    busy: boolean;
    onClose: () => void;
    onSave: (words: string[]) => void;
}) {
    const [draft, setDraft] = useState<string[]>([]);
    const [input, setInput] = useState('');

    useEffect(() => {
        if (!open) return;
        setDraft(words);
        setInput('');
    }, [open, words]);

    useEffect(() => {
        if (!open) return;
        const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
        document.addEventListener('keydown', close);
        return () => document.removeEventListener('keydown', close);
    }, [onClose, open]);

    if (!open) return null;

    const addWord = (event: FormEvent) => {
        event.preventDefault();
        const additions = input
            .split('|')
            .map((word) => word.trim())
            .filter(Boolean);
        if (!additions.length) return;
        setDraft((current) => [...new Set([...current, ...additions])]);
        setInput('');
    };

    return (
        <div
            className="drawer-layer settings-layer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="blocking-words-title">
            <button type="button" className="drawer-scrim" aria-label="关闭屏蔽词设置" onClick={onClose} />
            <section className="settings-dialog">
                <header>
                    <div>
                        <h2 id="blocking-words-title">屏蔽词</h2>
                        <span>包含屏蔽词的主贴内容将默认折叠</span>
                    </div>
                    <IconButton label="关闭屏蔽词设置" onClick={onClose}>
                        <CloseRegular size={19} />
                    </IconButton>
                </header>
                <div className="settings-content">
                    <form className="blocking-word-form" onSubmit={addWord}>
                        <input
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            placeholder="输入新的屏蔽词"
                            aria-label="新的屏蔽词"
                            maxLength={80}
                            autoFocus
                        />
                        <button type="submit" className="primary-button" disabled={!input.trim()}>
                            添加
                        </button>
                    </form>
                    <div className="blocking-word-list">
                        {draft.map((word) => (
                            <div key={word}>
                                <span>{word}</span>
                                <IconButton
                                    label={`删除屏蔽词 ${word}`}
                                    onClick={() => setDraft((current) => current.filter((item) => item !== word))}>
                                    <Delete2Regular size={16} />
                                </IconButton>
                            </div>
                        ))}
                        {!draft.length && <div className="settings-empty">还没有屏蔽词</div>}
                    </div>
                </div>
                <footer>
                    <button type="button" className="secondary-button" onClick={onClose}>
                        取消
                    </button>
                    <button type="button" className="primary-button" disabled={busy} onClick={() => onSave(draft)}>
                        {busy && <Loading3Regular className="spin" size={15} />}
                        保存
                    </button>
                </footer>
            </section>
        </div>
    );
}

function NotificationCenter({
    open,
    onClose,
    onOpenHole,
    onReadChanged,
}: {
    open: boolean;
    onClose: () => void;
    onOpenHole: (pid: number) => void;
    onReadChanged: () => void;
}) {
    const [tab, setTab] = useState<NotificationType>('int_msg');
    const [messages, setMessages] = useState<NotificationMessage[]>([]);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const requestVersion = useRef(0);

    const loadMessages = useCallback(
        async (nextPage = 1, append = false) => {
            const version = ++requestVersion.current;
            append ? setLoadingMore(true) : setLoading(true);
            setError('');
            try {
                const result = await fetchNotifications(tab, nextPage);
                if (version !== requestVersion.current) return;
                setMessages((current) => (append ? [...current, ...result.items] : result.items));
                setPage(nextPage);
                setLastPage(result.lastPage);
                if (tab === 'sys_msg') {
                    await markNotificationsRead('sys_msg');
                    if (version !== requestVersion.current) return;
                    setMessages((current) => current.map((message) => ({ ...message, is_read: 1 })));
                    onReadChanged();
                }
            } catch (nextError) {
                if (version === requestVersion.current) {
                    setError(nextError instanceof Error ? nextError.message : '消息加载失败');
                }
            } finally {
                if (version === requestVersion.current) {
                    setLoading(false);
                    setLoadingMore(false);
                }
            }
        },
        [onReadChanged, tab],
    );

    useEffect(() => {
        if (open) void loadMessages();
        return () => {
            requestVersion.current += 1;
        };
    }, [loadMessages, open]);

    useEffect(() => {
        if (!open) return;
        const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
        document.addEventListener('keydown', close);
        return () => document.removeEventListener('keydown', close);
    }, [onClose, open]);

    if (!open) return null;

    const markAll = async () => {
        try {
            await Promise.all([markNotificationsRead('int_msg'), markNotificationsRead('sys_msg')]);
            setMessages((current) => current.map((message) => ({ ...message, is_read: 1 })));
            onReadChanged();
        } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : '标记已读失败');
        }
    };

    const openMessage = async (message: NotificationMessage) => {
        const pid = notificationHole(message)?.pid ?? message.pid;
        if (!pid) return;
        if (tab === 'int_msg' && !message.is_read) {
            try {
                await markNotificationRead(message.id);
                setMessages((current) =>
                    current.map((item) => (item.id === message.id ? { ...item, is_read: 1 } : item)),
                );
                onReadChanged();
            } catch {
                // Opening the referenced post is still useful if the read receipt fails.
            }
        }
        onClose();
        onOpenHole(pid);
    };

    return (
        <div
            className="drawer-layer notification-layer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-title">
            <button type="button" className="drawer-scrim" aria-label="关闭消息" onClick={onClose} />
            <section className="notification-dialog">
                <header>
                    <h2 id="notification-title">消息通知</h2>
                    <div>
                        <button type="button" className="mark-read-button" onClick={() => void markAll()}>
                            全部已读
                        </button>
                        <IconButton label="关闭消息" onClick={onClose}>
                            <CloseRegular size={19} />
                        </IconButton>
                    </div>
                </header>
                <div className="notification-tabs" role="tablist">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'int_msg'}
                        className={tab === 'int_msg' ? 'active' : ''}
                        onClick={() => setTab('int_msg')}>
                        互动
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'sys_msg'}
                        className={tab === 'sys_msg' ? 'active' : ''}
                        onClick={() => setTab('sys_msg')}>
                        系统通知
                    </button>
                </div>
                <div className="notification-list">
                    {loading ? (
                        <LoadingRows />
                    ) : error && !messages.length ? (
                        <div className="inline-error">
                            <InformationRegular size={18} />
                            {error}
                        </div>
                    ) : messages.length ? (
                        <>
                            {messages.map((message) => {
                                const hole = notificationHole(message);
                                const pid = hole?.pid ?? message.pid;
                                const type = message.body?.type;
                                const title =
                                    tab === 'sys_msg'
                                        ? '系统通知'
                                        : type === 3
                                          ? '收到一条评论'
                                          : type === 4
                                            ? '收到一条点赞'
                                            : type === 5
                                              ? '收到一条回复'
                                              : '收到一条互动';
                                const timestamp = messageTimestamp(message.body?.created_at ?? message.timestamp);
                                const content = tab === 'sys_msg' ? message.content : message.body?.contents;
                                return (
                                    <article
                                        className={`notification-item ${message.is_read ? '' : 'unread'} ${pid ? 'clickable' : ''}`}
                                        onClick={() => void openMessage(message)}
                                        key={`${tab}-${message.id}`}>
                                        <div className="notification-item-heading">
                                            <strong>{title}</strong>
                                            {timestamp > 0 && (
                                                <time title={fullTime(timestamp)}>{formatTime(timestamp)}</time>
                                            )}
                                        </div>
                                        {content && (
                                            <p>
                                                <RichText text={content} />
                                            </p>
                                        )}
                                        {pid && (
                                            <div className="notification-origin">
                                                <span>原帖 #{pid}</span>
                                                {hole?.text && <p>{displayText(hole.text)}</p>}
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                            {page < lastPage && (
                                <button
                                    type="button"
                                    className="load-notifications"
                                    disabled={loadingMore}
                                    onClick={() => void loadMessages(page + 1, true)}>
                                    {loadingMore && <Loading3Regular className="spin" size={15} />}
                                    查看更多
                                </button>
                            )}
                        </>
                    ) : (
                        <EmptyState mode="latest" searching={false} message="暂无消息" />
                    )}
                </div>
            </section>
        </div>
    );
}

function App() {
    const [mode, setMode] = useState<FeedMode>('latest');
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
        const stored = localStorage.getItem('treehole-art-theme');
        return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    });
    const [commentViewMode, setCommentViewMode] = useState<CommentViewMode>(() =>
        localStorage.getItem('treehole-art-comment-view') === 'inline' ? 'inline' : 'modal',
    );
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [queryInput, setQueryInput] = useState('');
    const [activeQuery, setActiveQuery] = useState<ParsedQuery>(() => parseQuery(''));
    const [selectedLabel, setSelectedLabel] = useState<number | undefined>();
    const [selectedBookmark, setSelectedBookmark] = useState<number | undefined>();
    const [tags, setTags] = useState<TagNode[]>([]);
    const [bookmarkGroups, setBookmarkGroups] = useState<BookmarkGroup[]>([]);
    const [blockingWords, setBlockingWords] = useState<string[]>([]);
    const [postingIdentities, setPostingIdentities] = useState<PostingIdentity[]>([]);
    const [holes, setHoles] = useState<Hole[]>([]);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
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

    const loadFirstPage = useCallback(async () => {
        feedController.current?.abort();
        const controller = new AbortController();
        feedController.current = controller;
        setLoading(true);
        setFeedError('');
        setBookmarkMenuPid(null);
        try {
            const result = await fetchFeed({
                mode,
                page: 1,
                limit: PAGE_SIZE,
                keyword: activeQuery.backendQuery,
                label: selectedLabel,
                bookmarkId: selectedBookmark,
                signal: controller.signal,
            });
            setHoles(result.items);
            setCandidateTotal(result.total);
            setLastPage(result.lastPage);
            setPage(1);
        } catch (nextError) {
            if ((nextError as Error).name !== 'AbortError') {
                setFeedError(nextError instanceof Error ? nextError.message : '信息流加载失败');
            }
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    }, [activeQuery, mode, selectedBookmark, selectedLabel]);

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
        if (!activeQuery.hasAdvanced) return holes;
        return holes.filter((hole) => matchesAdvancedQuery(hole.text, activeQuery));
    }, [activeQuery, holes]);

    const highlightTerms = useMemo(() => {
        const baseTerms = activeQuery.baseQuery.replace(/^#(?=\d+$)/, '').split(/\s+/);
        return [...new Set([...baseTerms, ...activeQuery.includes].filter(Boolean))];
    }, [activeQuery]);

    const switchMode = (nextMode: FeedMode, bookmarkId?: number) => {
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

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        setActiveQuery(parseQuery(queryInput.trim()));
        setSelectedHole(null);
        setDetailStack([]);
        setExpandedCommentPids(new Set());
        setCopyMenuPid(null);
        setSelectedBookmark(undefined);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

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
        if (loadingMore || page >= lastPage) return;
        feedController.current?.abort();
        const controller = new AbortController();
        feedController.current = controller;
        setLoadingMore(true);
        setFeedError('');
        const nextPage = page + 1;
        try {
            const result = await fetchFeed({
                mode,
                page: nextPage,
                limit: PAGE_SIZE,
                keyword: activeQuery.backendQuery,
                label: selectedLabel,
                bookmarkId: selectedBookmark,
                signal: controller.signal,
            });
            setHoles((current) => {
                const known = new Set(current.map((hole) => hole.pid));
                return [...current, ...result.items.filter((hole) => !known.has(hole.pid))];
            });
            setPage(nextPage);
            setLastPage(result.lastPage);
        } catch (nextError) {
            if ((nextError as Error).name !== 'AbortError') {
                setFeedError(nextError instanceof Error ? nextError.message : '加载更多失败');
            }
        } finally {
            if (!controller.signal.aborted) setLoadingMore(false);
        }
    };

    loadMoreAction.current = () => void loadMore();

    useEffect(() => {
        const sentinel = feedSentinelRef.current;
        if (!sentinel || loading || loadingMore || page >= lastPage) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) loadMoreAction.current();
            },
            { rootMargin: '480px 0px' },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [lastPage, loading, loadingMore, page, visibleHoles.length]);

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

    const copyHole = async (hole: Hole, includeComments: boolean) => {
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
    };

    const copyPid = async (pid: number) => {
        try {
            await writeClipboard(String(pid));
            setToast(`${pid} 洞号已复制`);
        } catch {
            setToast('复制洞号失败');
        }
    };

    const saveBlockingWords = async (words: string[]) => {
        setBlockingWordsBusy(true);
        try {
            await updateBlockingWords(words);
            setBlockingWords([...new Set(words.map((word) => word.trim()).filter(Boolean))]);
            setBlockingWordsOpen(false);
            setToast('屏蔽词已更新');
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
    const themeIcon =
        themeMode === 'light' ? (
            <SunRegular size={18} />
        ) : themeMode === 'dark' ? (
            <MoonRegular size={18} />
        ) : (
            <ComputerRegular size={18} />
        );
    const themeLabel = themeMode === 'light' ? '浅色' : themeMode === 'dark' ? '深色' : '跟随系统';
    const commentViewLabel = commentViewMode === 'modal' ? '悬浮' : '展开';

    return (
        <div
            className="app-shell"
            onClick={() => {
                setBookmarkMenuPid(null);
                setCopyMenuPid(null);
                setMobileMenuOpen(false);
            }}>
            {mobileMenuOpen && (
                <button
                    type="button"
                    className="mobile-drawer-scrim"
                    aria-label="关闭导航"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}
            <aside className={`left-rail ${mobileMenuOpen ? 'mobile-open' : ''}`}>
                <button type="button" className="brand" onClick={goHome} title="返回首页最新">
                    <img src={PKU_LOGO_URL} alt="北京大学" />
                    <div>
                        <strong>北大树洞</strong>
                        <span>PKU Treehole</span>
                    </div>
                </button>
                <nav aria-label="主导航">
                    <button
                        type="button"
                        className={mode === 'latest' ? 'active' : ''}
                        onClick={() => switchMode('latest')}>
                        <Home4Regular size={19} />
                        <span>最新</span>
                    </button>
                    <button
                        type="button"
                        className={mode === 'bookmarks' ? 'active' : ''}
                        onClick={() => switchMode('bookmarks')}>
                        <BookmarkRegular size={19} />
                        <span>收藏</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setNotificationsOpen(true);
                            setMobileMenuOpen(false);
                        }}>
                        <NotificationRegular size={19} />
                        <span>消息{unreadNotifications > 0 ? `（${unreadNotifications}）` : ''}</span>
                    </button>
                </nav>
                <div className="rail-footer">
                    <span className="status-dot" />
                    {isDemo ? '本地预览' : '已连接树洞'}
                </div>
            </aside>

            <main className="main-column">
                <header className="topbar">
                    <button type="button" className="mobile-home-button" aria-label="返回首页最新" onClick={goHome}>
                        <img className="mobile-pku-logo" src={PKU_LOGO_URL} alt="北京大学" />
                    </button>
                    <IconButton
                        label={mobileMenuOpen ? '关闭导航' : '打开导航'}
                        className="mobile-menu-button"
                        aria-expanded={mobileMenuOpen}
                        onClick={(event) => {
                            event.stopPropagation();
                            setMobileMenuOpen((open) => !open);
                        }}>
                        {mobileMenuOpen ? <CloseRegular size={20} /> : <MenuRegular size={20} />}
                    </IconButton>
                    <form className="search-box" onSubmit={submitSearch}>
                        <Search2Regular size={18} />
                        <input
                            ref={searchRef}
                            value={queryInput}
                            onChange={(event) => setQueryInput(event.target.value)}
                            placeholder="搜索内容或 #洞号，-: 排除关键字"
                            aria-label="搜索树洞"
                            title="使用 -:关键字 排除包含该词的结果"
                        />
                        {queryInput && (
                            <IconButton label="清空搜索" className="search-clear" onClick={clearSearch}>
                                <CloseRegular size={15} />
                            </IconButton>
                        )}
                        <button type="submit" className="search-submit">
                            搜索
                        </button>
                    </form>
                    <div className="topbar-actions">
                        <IconButton
                            label={unreadNotifications ? `${unreadNotifications} 条未读消息` : '消息通知'}
                            className={`notification-button ${unreadNotifications ? 'has-unread' : ''}`}
                            onClick={() => setNotificationsOpen(true)}>
                            <NotificationRegular size={18} />
                            {unreadNotifications > 0 && (
                                <span className="notification-badge">{Math.min(unreadNotifications, 99)}</span>
                            )}
                        </IconButton>
                        <IconButton label={`评论展示：${commentViewLabel}，点击切换`} onClick={toggleCommentView}>
                            {commentViewMode === 'modal' ? (
                                <WindowsRegular size={18} />
                            ) : (
                                <LayoutBottomOpenRegular size={18} />
                            )}
                        </IconButton>
                        <IconButton label={`外观：${themeLabel}，点击切换`} onClick={cycleTheme}>
                            {themeIcon}
                        </IconButton>
                        <IconButton label="刷新" onClick={() => setRefreshKey((key) => key + 1)}>
                            <Refresh3Regular size={18} />
                        </IconButton>
                    </div>
                </header>

                <Composer
                    tags={tags}
                    identities={postingIdentities}
                    onPublished={handlePublished}
                    onNotice={setToast}
                />

                <div className="feed-heading">
                    <div>
                        <h1>{mode === 'latest' ? '最新树洞' : '我的收藏'}</h1>
                        <span>{candidateTotal ? `${candidateTotal} 条内容` : '实时更新'}</span>
                    </div>
                    <TagPicker
                        tags={tags}
                        value={selectedLabel}
                        onChange={setSelectedLabel}
                        icon={<Filter3Regular size={16} />}
                        placeholder="全部标签"
                        emptyLabel="全部标签"
                        ariaLabel="筛选标签"
                        className="feed-tag-picker"
                    />
                </div>

                {activeQuery.hasAdvanced && (
                    <div className="query-summary" role="status">
                        <div className="query-chips">
                            {activeQuery.baseQuery && (
                                <span className="query-chip neutral">搜索 · {activeQuery.baseQuery}</span>
                            )}
                            {activeQuery.includes.map((term) => (
                                <span className="query-chip include" key={`i-${term}`}>
                                    + {term}
                                </span>
                            ))}
                            {activeQuery.excludes.map((term) => (
                                <span className="query-chip exclude" key={`e-${term}`}>
                                    - {term}
                                </span>
                            ))}
                        </div>
                        <span>
                            {visibleHoles.length}/{holes.length} 匹配
                        </span>
                    </div>
                )}

                <section className="feed" aria-live="polite">
                    {loading ? (
                        <LoadingRows />
                    ) : feedError && !holes.length ? (
                        <div className="error-state">
                            <InformationRegular size={22} />
                            <strong>{feedError}</strong>
                            <button
                                type="button"
                                onClick={
                                    feedError.includes('登录')
                                        ? () =>
                                              window.location.assign(
                                                  `/redirect_iaaa_login?uuid=${encodeURIComponent(getDeviceUuid())}`,
                                              )
                                        : loadFirstPage
                                }>
                                {feedError.includes('登录') ? '重新登录' : '重试'}
                            </button>
                        </div>
                    ) : visibleHoles.length ? (
                        <>
                            {visibleHoles.map((hole) => (
                                <Fragment key={hole.pid}>
                                    <HoleRow
                                        hole={hole}
                                        bookmarkOpen={bookmarkMenuPid === hole.pid}
                                        copyOpen={copyMenuPid === hole.pid}
                                        bookmarkGroups={bookmarkGroups}
                                        bookmarkBusy={bookmarkBusy}
                                        praiseBusy={likingPids.has(hole.pid)}
                                        onOpenComments={() => openComments(hole)}
                                        onOpenBookmarkMenu={() => {
                                            setCopyMenuPid(null);
                                            setBookmarkMenuPid((current) => (current === hole.pid ? null : hole.pid));
                                        }}
                                        onToggleBookmarkDirect={() => void toggleBookmarkDirect(hole)}
                                        onOpenCopyMenu={() => {
                                            setBookmarkMenuPid(null);
                                            setCopyMenuPid((current) => (current === hole.pid ? null : hole.pid));
                                        }}
                                        onToggleBookmark={(group) => void toggleBookmarkFor(hole, group)}
                                        onCreateBookmark={(name) => void createBookmarkFor(hole, name)}
                                        onCopy={(includeComments) => {
                                            setCopyMenuPid(null);
                                            void copyHole(hole, includeComments);
                                        }}
                                        onTogglePraise={() => void togglePraiseFor(hole)}
                                        onCopyPid={(pid) => void copyPid(pid)}
                                        onOpenReferencedHole={(pid) => void openReferencedPid(pid, hole)}
                                        highlightTerms={highlightTerms}
                                        blockingWords={blockingWords}
                                    />
                                    {commentViewMode === 'inline' && expandedCommentPids.has(hole.pid) && (
                                        <CommentsPanel
                                            hole={hole}
                                            displayMode="inline"
                                            identities={postingIdentities}
                                            onClose={() => closeInlineComments(hole.pid)}
                                            onCommentPublished={() =>
                                                updateHole(hole.pid, (item) => ({ ...item, reply: item.reply + 1 }))
                                            }
                                            onNotice={setToast}
                                            onPid={(pid) => void openReferencedPid(pid, hole)}
                                        />
                                    )}
                                </Fragment>
                            ))}
                            {feedError && (
                                <div className="inline-error">
                                    <InformationRegular size={18} />
                                    {feedError}
                                </div>
                            )}
                            {page < lastPage && (
                                <div className="infinite-sentinel" ref={feedSentinelRef}>
                                    <Loading3Regular size={17} className="spin" />
                                    正在加载更多
                                </div>
                            )}
                            {page >= lastPage && (
                                <div className="feed-end">
                                    <span />
                                    已经到底了
                                    <span />
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <EmptyState mode={mode} searching={isSearching} />
                            {page < lastPage && (
                                <div className="infinite-sentinel" ref={feedSentinelRef}>
                                    <Loading3Regular size={17} className="spin" />
                                    正在继续查找
                                </div>
                            )}
                        </>
                    )}
                </section>
            </main>

            <aside className="right-rail">
                <section className="side-bookmarks-section">
                    <div className="side-heading">
                        <span>收藏夹</span>
                        <BookmarkRegular size={17} />
                    </div>
                    <SideBookmarkMenu
                        groups={bookmarkGroups}
                        active={mode === 'bookmarks'}
                        selectedId={selectedBookmark}
                        onSelect={(id) => switchMode('bookmarks', id)}
                        onCreate={createEmptyBookmark}
                        onRequestDelete={setBookmarkDeleteTarget}
                        busy={bookmarkBusy}
                    />
                </section>
                <section className="side-tags-section">
                    <div className="side-heading">
                        <span>标签</span>
                        <HashtagRegular size={17} />
                    </div>
                    <SideTagMenu tags={tags} value={selectedLabel} onChange={setSelectedLabel} />
                </section>
                <section className="side-settings-section">
                    <button type="button" className="side-settings-button" onClick={() => setBlockingWordsOpen(true)}>
                        <span>
                            <ShieldRegular size={16} />
                            屏蔽词
                        </span>
                        <small>{blockingWords.length ? `${blockingWords.length} 个` : '未设置'}</small>
                    </button>
                </section>
            </aside>

            <nav className="mobile-nav" aria-label="移动端导航">
                <button
                    type="button"
                    className={mode === 'latest' ? 'active' : ''}
                    onClick={() => switchMode('latest')}>
                    <Home4Regular size={20} />
                    <span>最新</span>
                </button>
                <button
                    type="button"
                    className={mode === 'bookmarks' ? 'active' : ''}
                    onClick={() => switchMode('bookmarks')}>
                    <BookmarkRegular size={20} />
                    <span>收藏</span>
                </button>
            </nav>

            {commentViewMode === 'modal' && selectedHole && (
                <CommentsPanel
                    hole={selectedHole}
                    displayMode="modal"
                    identities={postingIdentities}
                    onClose={() => setSelectedHole(null)}
                    onCommentPublished={() =>
                        updateHole(selectedHole.pid, (hole) => ({ ...hole, reply: hole.reply + 1 }))
                    }
                    onNotice={setToast}
                    onPid={(pid) => void openReferencedPid(pid, selectedHole)}
                />
            )}
            {currentDetailHole && (
                <div
                    className="drawer-layer hole-detail-layer"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="hole-detail-title">
                    <button
                        type="button"
                        className="drawer-scrim"
                        aria-label="关闭树洞详情"
                        onClick={closeHoleDetails}
                    />
                    <aside className="hole-detail-modal">
                        <header className="hole-detail-header">
                            <button
                                type="button"
                                className="detail-back"
                                disabled={detailStack.length <= 1}
                                onClick={goBackInHoleDetails}>
                                <ArrowLeftRegular size={18} />
                                <span>返回</span>
                            </button>
                            <div className="hole-detail-heading">
                                <strong id="hole-detail-title">#{currentDetailHole.pid}</strong>
                                <span>
                                    {detailStack.length > 1 ? `引用第 ${detailStack.length - 1} 层` : '来源树洞'}
                                </span>
                            </div>
                            {detailLoadingPid && (
                                <span className="detail-loading">
                                    <Loading3Regular className="spin" size={15} />
                                    正在打开 #{detailLoadingPid}
                                </span>
                            )}
                            <button
                                type="button"
                                className="detail-close"
                                aria-label="关闭全部树洞详情"
                                onClick={closeHoleDetails}>
                                <CloseRegular size={20} />
                            </button>
                        </header>
                        <div className="hole-detail-scroll">
                            <HoleRow
                                hole={currentDetailHole}
                                bookmarkOpen={bookmarkMenuPid === currentDetailHole.pid}
                                copyOpen={copyMenuPid === currentDetailHole.pid}
                                bookmarkGroups={bookmarkGroups}
                                bookmarkBusy={bookmarkBusy}
                                praiseBusy={likingPids.has(currentDetailHole.pid)}
                                onOpenComments={() =>
                                    document
                                        .getElementById(`detail-comments-${currentDetailHole.pid}`)
                                        ?.scrollIntoView({ behavior: 'smooth' })
                                }
                                onOpenBookmarkMenu={() => {
                                    setCopyMenuPid(null);
                                    setBookmarkMenuPid((current) =>
                                        current === currentDetailHole.pid ? null : currentDetailHole.pid,
                                    );
                                }}
                                onToggleBookmarkDirect={() => void toggleBookmarkDirect(currentDetailHole)}
                                onOpenCopyMenu={() => {
                                    setBookmarkMenuPid(null);
                                    setCopyMenuPid((current) =>
                                        current === currentDetailHole.pid ? null : currentDetailHole.pid,
                                    );
                                }}
                                onToggleBookmark={(group) => void toggleBookmarkFor(currentDetailHole, group)}
                                onCreateBookmark={(name) => void createBookmarkFor(currentDetailHole, name)}
                                onCopy={(includeComments) => {
                                    setCopyMenuPid(null);
                                    void copyHole(currentDetailHole, includeComments);
                                }}
                                onTogglePraise={() => void togglePraiseFor(currentDetailHole)}
                                onCopyPid={(pid) => void copyPid(pid)}
                                onOpenReferencedHole={(pid) => void openReferencedPid(pid, currentDetailHole)}
                                highlightTerms={[]}
                                blockingWords={blockingWords}
                            />
                            <div id={`detail-comments-${currentDetailHole.pid}`}>
                                <CommentsPanel
                                    key={`detail-comments-${currentDetailHole.pid}`}
                                    hole={currentDetailHole}
                                    displayMode="inline"
                                    identities={postingIdentities}
                                    onClose={closeHoleDetails}
                                    showClose={false}
                                    onCommentPublished={() =>
                                        updateHole(currentDetailHole.pid, (hole) => ({
                                            ...hole,
                                            reply: hole.reply + 1,
                                        }))
                                    }
                                    onNotice={setToast}
                                    onPid={(pid) => void openReferencedPid(pid, currentDetailHole)}
                                />
                            </div>
                        </div>
                    </aside>
                </div>
            )}
            <NotificationCenter
                open={notificationsOpen}
                onClose={() => setNotificationsOpen(false)}
                onOpenHole={(pid) => void openHoleDetails(pid)}
                onReadChanged={refreshUnreadCount}
            />
            <BlockingWordsDialog
                open={blockingWordsOpen}
                words={blockingWords}
                busy={blockingWordsBusy}
                onClose={() => setBlockingWordsOpen(false)}
                onSave={(words) => void saveBlockingWords(words)}
            />
            <BookmarkDeleteDialog
                target={bookmarkDeleteTarget}
                busy={bookmarkBusy}
                onClose={() => setBookmarkDeleteTarget(null)}
                onConfirm={() => void deleteBookmarkGroup()}
            />
            {toast && (
                <div className="toast" role="status">
                    <CheckRegular size={17} />
                    {toast}
                </div>
            )}
        </div>
    );
}

export default App;
