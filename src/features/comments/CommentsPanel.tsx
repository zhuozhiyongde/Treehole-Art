import { CloseRegular, Delete2Regular, InformationRegular, Loading3Regular, PicRegular } from '@mingcute/react/core-regular';
import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchComments, prepareUploadImage, publishComment } from '../../api';
import { commentColorIndex, commentColorToken } from '../../commentColors';
import { IconButton } from '../../components/IconButton';
import { IdentityBadges } from '../../components/IdentityBadges';
import { MediaImages } from '../../components/MediaImages';
import { RichText } from '../../components/RichText';
import { commentSender, formatTime, fullTime } from '../../lib/presentation';
import { displayText } from '../../normalize';
import type { CommentViewMode, Hole, PostingIdentity, PublishIdentityOptions, TreeholeComment } from '../../types';
import { PostingIdentityControls } from '../composer/PostingIdentityControls';
import { EmptyState, LoadingRows } from '../feed/FeedStates';

function commentColor(name = '洞友') {
    const normalizedName = displayText(name) || '洞友';
    return commentColorToken(commentColorIndex(normalizedName));
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

export function CommentsPanel({
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
