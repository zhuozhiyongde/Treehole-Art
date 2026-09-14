import type { Hole, TreeholeComment } from '../types';

export function IdentityBadges({ item }: { item: Hole | TreeholeComment }) {
    const nickname = item.exclusive_id_info?.exclusive_id;
    const labels = [item.identity_info?.department, item.identity_info?.gender, item.identity_info?.level].filter(
        Boolean,
    ) as string[];
    if (!nickname && !labels.length) return null;
    return (
        <span className="identity-badges">
            {nickname && <span className="nickname-badge">{nickname}</span>}
            {labels.map((label) => (
                <span key={label}>{label}</span>
            ))}
        </span>
    );
}

