import { CloseRegular, Delete2Regular, Loading3Regular } from '@mingcute/react/core-regular';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { IconButton } from '../../components/IconButton';

export function BlockingWordsDialog({
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

