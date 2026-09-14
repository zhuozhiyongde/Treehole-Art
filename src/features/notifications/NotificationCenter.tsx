import { CloseRegular, InformationRegular, Loading3Regular } from '@mingcute/react/core-regular';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchNotifications, markNotificationRead, markNotificationsRead } from '../../api';
import { IconButton } from '../../components/IconButton';
import { RichText } from '../../components/RichText';
import { formatTime, fullTime, messageTimestamp, notificationHole } from '../../lib/presentation';
import { displayText } from '../../normalize';
import type { NotificationMessage, NotificationType } from '../../types';
import { EmptyState, LoadingRows } from '../feed/FeedStates';

export function NotificationCenter({
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

