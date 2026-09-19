import { CheckRegular } from '@mingcute/react/core-regular';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TagNode } from '../../types';

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

export function TagPicker({
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
                <div
                    className="popover tag-picker-popover tag-cascade"
                    onClick={(event) => event.stopPropagation()}>
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
                    <div
                        className="tag-cascade-column tag-cascade-options"
                        role="listbox"
                        aria-label={ariaLabel}>
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
                        {!activeGroup?.options.length && (
                            <span className="tag-picker-empty">此分类暂无标签</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export function SideTagMenu({
    tags,
    value,
    onChange,
    placement = 'left',
}: {
    tags: TagNode[];
    value?: number;
    onChange: (value?: number) => void;
    placement?: 'left' | 'right';
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
        const isMobileDrawer = window.matchMedia('(max-width: 760px)').matches;
        const preferredLeft =
            placement === 'right' ? anchorRect.right + 8 : anchorRect.left - panelWidth - 8;
        setPosition({
            top: Math.max(
                isMobileDrawer ? 64 : 8,
                Math.min(
                    isMobileDrawer ? anchorRect.bottom + 4 : anchorRect.top,
                    window.innerHeight - panelHeight - (isMobileDrawer ? 66 : 8),
                ),
            ),
            left: Math.max(8, Math.min(isMobileDrawer ? 16 : preferredLeft, window.innerWidth - panelWidth - 8)),
        });
    }, [openGroupId, placement]);

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
            <div
                className="side-options side-tag-groups"
                role="listbox"
                aria-label="标签分类">
                <button
                    type="button"
                    className={!value ? 'active' : ''}
                    onClick={() => choose(undefined)}>
                    <span>全部内容</span>
                    {!value && <CheckRegular size={15} />}
                </button>
                {groups.map((group) => (
                    <button
                        type="button"
                        className={`${selectedGroup?.id === group.id ? 'active' : ''} ${
                            openGroupId === group.id ? 'open' : ''
                        }`}
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
                        <div
                            role="listbox"
                            aria-label={`${openGroup.name}标签`}>
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
                            {!openGroup.options.length && (
                                <span className="side-empty">此分类暂无标签</span>
                            )}
                        </div>
                    </div>,
                    portalHost,
                )}
        </div>
    );
}
