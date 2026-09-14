import type { CSSProperties } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { displayText } from '../normalize';

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

export function RichText({
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

export function ExpandableRichText({
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

