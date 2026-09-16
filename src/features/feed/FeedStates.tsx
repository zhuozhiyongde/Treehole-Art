import { BookmarkRegular, CoinRegular, Search2Regular } from '@mingcute/react/core-regular';
import type { FeedMode } from '../../types';

export function LoadingRows() {
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

export function EmptyState({ mode, searching, message }: { mode: FeedMode; searching: boolean; message?: string }) {
    const emptyLabel =
        mode === 'bookmarks' ? '还没有关注的树洞' : mode === 'bounty' ? '暂时没有悬赏' : '暂时没有内容';
    return (
        <div className="empty-state">
            <div className="empty-icon">
                {searching ? (
                    <Search2Regular size={22} />
                ) : mode === 'bounty' ? (
                    <CoinRegular size={22} />
                ) : (
                    <BookmarkRegular size={22} />
                )}
            </div>
            <strong>{message || (searching ? '没有匹配的树洞' : emptyLabel)}</strong>
            {!message && <span>{searching ? '换一组条件再试试' : '稍后刷新看看'}</span>}
        </div>
    );
}
