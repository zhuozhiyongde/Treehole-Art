import { AddRegular, CheckRegular } from '@mingcute/react/core-regular';
import type { FormEvent } from 'react';
import { useState } from 'react';
import type { BookmarkGroup, Hole } from '../../types';

export function BookmarkMenu({
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

