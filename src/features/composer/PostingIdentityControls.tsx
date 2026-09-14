import { User4Regular } from '@mingcute/react/core-regular';
import { authorizeIdentityLabels } from '../../api';
import type { PostingIdentity } from '../../types';

const IDENTITY_LABELS = [
    { id: 1, label: '二级单位' },
    { id: 2, label: '性别' },
    { id: 3, label: '类别' },
];

export function PostingIdentityControls({
    identities,
    exclusiveId,
    identityTypes,
    onExclusiveIdChange,
    onIdentityTypesChange,
    onNotice,
    compact = false,
}: {
    identities: PostingIdentity[];
    exclusiveId?: number;
    identityTypes: number[];
    onExclusiveIdChange: (id?: number) => void;
    onIdentityTypesChange: (types: number[]) => void;
    onNotice: (message: string) => void;
    compact?: boolean;
}) {
    const toggleIdentityLabels = async (checked: boolean) => {
        if (!checked) {
            onIdentityTypesChange([]);
            return;
        }
        try {
            await authorizeIdentityLabels();
            onIdentityTypesChange([1, 2, 3]);
        } catch (error) {
            onNotice(error instanceof Error ? error.message : '身份标签授权失败');
        }
    };

    return (
        <div className={`posting-identity ${compact ? 'compact' : ''}`}>
            <label className="identity-select">
                <User4Regular size={16} />
                <select
                    value={exclusiveId ?? 0}
                    aria-label="发布身份"
                    onChange={(event) => {
                        const value = Number(event.target.value);
                        onExclusiveIdChange(value || undefined);
                        if (value) onIdentityTypesChange([]);
                    }}>
                    <option value={0}>匿名发布</option>
                    {identities.map((identity) => (
                        <option value={identity.id} key={identity.id}>
                            {identity.exclusive_id}
                        </option>
                    ))}
                </select>
            </label>
            <label className="identity-toggle" title={exclusiveId ? '使用昵称时不能展示身份标签' : '展示身份标签'}>
                <input
                    type="checkbox"
                    checked={identityTypes.length > 0}
                    disabled={Boolean(exclusiveId)}
                    onChange={(event) => void toggleIdentityLabels(event.target.checked)}
                />
                <span>身份标签</span>
            </label>
            {!exclusiveId && identityTypes.length > 0 && (
                <div className="identity-types" aria-label="选择身份标签">
                    {IDENTITY_LABELS.map((item) => (
                        <label key={item.id}>
                            <input
                                type="checkbox"
                                checked={identityTypes.includes(item.id)}
                                onChange={(event) =>
                                    onIdentityTypesChange(
                                        event.target.checked
                                            ? [...identityTypes, item.id].sort()
                                            : identityTypes.filter((id) => id !== item.id),
                                    )
                                }
                            />
                            <span>{item.label}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

