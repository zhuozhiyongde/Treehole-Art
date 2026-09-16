import { AwardRegular, ShieldRegular } from '@mingcute/react/core-regular';
import { useEffect, useState } from 'react';
import { fetchHole } from '../../api';
import { ExpandableRichText } from '../../components/RichText';
import { PostImage } from '../../components/MediaImages';
import { displayText } from '../../normalize';
import { formatTime, fullTime } from '../../lib/presentation';
import type { BlockingWordMode, Hole } from '../../types';

export function QuotedHole({
    pid,
    initialHole,
    onOpen,
    onPid,
    highlightTerms,
    blockingWords,
    blockingWordMode,
    onCopyPid,
}: {
    pid: number;
    initialHole?: Hole;
    onOpen: (pid: number) => void;
    onPid: (pid: number) => void;
    highlightTerms: string[];
    blockingWords: string[];
    blockingWordMode: BlockingWordMode;
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

    if (!hole || (blockedWord && blockingWordMode === 'hide')) return null;
    const isBounty = Number(hole.kind) === 1;
    const rewardCost = Number(hole.reward_cost);
    const bountyLabel = Number.isFinite(rewardCost) && rewardCost > 0 ? `悬赏 ${rewardCost} 树叶` : '悬赏树洞';
    return (
        <aside
            className={`quoted-hole ${isBounty ? 'is-bounty' : ''}`}
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
                {isBounty && (
                    <span className="quoted-bounty-badge">
                        <AwardRegular size={13} />
                        {bountyLabel}
                    </span>
                )}
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
