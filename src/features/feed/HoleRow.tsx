import {
    AwardRegular,
    BookmarkRegular,
    Copy2Regular,
    DownSmallRegular,
    HeartRegular,
    Message3Regular,
    ShieldRegular,
} from '@mingcute/react/core-regular';
import { BookmarkFilled, HeartFilled, Message3Filled } from '@mingcute/react/core-filled';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useEffect, useState } from 'react';
import { IdentityBadges } from '../../components/IdentityBadges';
import { ExpandableRichText } from '../../components/RichText';
import { MediaImages, PostImage } from '../../components/MediaImages';
import { displayText } from '../../normalize';
import { formatTime, fullTime } from '../../lib/presentation';
import type { BlockingWordMode, BookmarkGroup, Hole } from '../../types';
import { BookmarkMenu } from '../bookmarks/BookmarkMenu';
import { QuotedHole } from './QuotedHole';

function tagTone(id?: number) {
    return `tag-tone-${Math.abs(id ?? 0) % 5}`;
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

export function HoleRow({
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
    blockingWordMode,
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
    blockingWordMode: BlockingWordMode;
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
    const isBounty = Number(hole.kind) === 1;
    const rewardCost = Number(hole.reward_cost);
    const hasRewardCost = Number.isFinite(rewardCost) && rewardCost > 0;
    const bountyResolved = Number(hole.has_reward_good) === 1;

    if (blockedWord && blockingWordMode === 'hide') return null;

    return (
        <article
            className={`hole-row ${isBounty ? 'is-bounty' : ''} ${bountyResolved ? 'is-bounty-resolved' : ''}`}
            onClick={onOpenComments}>
            <div className="hole-meta">
                {isBounty && (
                    <span className={`badge bounty-status-badge ${bountyResolved ? 'is-resolved' : ''}`}>
                        {bountyResolved ? '悬赏已完成' : '悬赏征集中'}
                    </span>
                )}
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
            {isBounty && (
                <div className="bounty-summary">
                    <AwardRegular size={18} />
                    <span>
                        <strong>{bountyResolved ? '悬赏已完成' : '悬赏征集中'}</strong>
                        <small>
                            {hasRewardCost ? `最佳答案奖励 ${rewardCost} 树叶` : '采纳最佳答案后发放奖励'}
                        </small>
                    </span>
                </div>
            )}
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
                            blockingWordMode={blockingWordMode}
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
