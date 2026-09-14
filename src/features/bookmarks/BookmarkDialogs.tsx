import { AddRegular, CheckRegular, CloseRegular, Delete2Regular, FolderRegular, Loading3Regular } from '@mingcute/react/core-regular';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { IconButton } from '../../components/IconButton';
import type { BookmarkGroup } from '../../types';

export function SideBookmarkMenu({
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

export function BookmarkDeleteDialog({
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

