import {
    CoinRegular,
    Delete2Regular,
    HashtagRegular,
    Loading3Regular,
    PicRegular,
    SendRegular,
} from '@mingcute/react/core-regular';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { prepareUploadImage, publishHole } from '../../api';
import type { Hole, PostingIdentity, PublishIdentityOptions, TagNode } from '../../types';
import { IconButton } from '../../components/IconButton';
import { TagPicker } from '../tags/TagMenus';
import { PostingIdentityControls } from './PostingIdentityControls';

export function Composer({
    tags,
    identities,
    onPublished,
    onNotice,
}: {
    tags: TagNode[];
    identities: PostingIdentity[];
    onPublished: (hole: Hole) => void;
    onNotice: (message: string) => void;
}) {
    const [text, setText] = useState('');
    const [label, setLabel] = useState<number | undefined>();
    const [image, setImage] = useState<File | undefined>();
    const [exclusiveId, setExclusiveId] = useState<number | undefined>();
    const [identityTypes, setIdentityTypes] = useState<number[]>([]);
    const [bountyEnabled, setBountyEnabled] = useState(false);
    const [rewardCostInput, setRewardCostInput] = useState('1');
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const previewUrl = useMemo(() => (image ? URL.createObjectURL(image) : ''), [image]);

    useEffect(
        () => () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        },
        [previewUrl],
    );

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const trimmed = text.trim();
        if ((!trimmed && !image) || busy) return;
        const rewardCost = bountyEnabled ? Number(rewardCostInput) : undefined;
        if (bountyEnabled && (!Number.isSafeInteger(rewardCost) || (rewardCost ?? 0) < 1)) {
            onNotice('请输入大于 0 的整数树叶数');
            return;
        }
        setBusy(true);
        try {
            const upload = image ? await prepareUploadImage(image, 1024 * 1024) : undefined;
            const identity: PublishIdentityOptions = {
                exclusiveId,
                exclusiveName: identities.find((item) => item.id === exclusiveId)?.exclusive_id,
                identityTypes,
            };
            const hole = await publishHole(trimmed, label, upload, identity, rewardCost);
            onPublished(hole);
            setText('');
            setLabel(undefined);
            setImage(undefined);
            setExclusiveId(undefined);
            setIdentityTypes([]);
            setBountyEnabled(false);
            setRewardCostInput('1');
            onNotice('发布成功');
        } catch (nextError) {
            onNotice(nextError instanceof Error ? nextError.message : '发布失败');
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="composer" onSubmit={submit}>
            <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                onInput={(event) => {
                    event.currentTarget.style.height = 'auto';
                    event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 180)}px`;
                }}
                placeholder="分享此刻的想法..."
                aria-label="树洞内容"
                maxLength={5000}
                rows={2}
            />
            {image && (
                <div className="composer-attachment">
                    <img src={previewUrl} alt="待发布图片预览" />
                    <span>{image.name}</span>
                    <IconButton label="移除图片" onClick={() => setImage(undefined)}>
                        <Delete2Regular size={16} />
                    </IconButton>
                </div>
            )}
            {bountyEnabled && (
                <div className="composer-bounty-options">
                    <CoinRegular size={18} />
                    <label htmlFor="composer-reward-cost">悬赏</label>
                    <input
                        id="composer-reward-cost"
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={rewardCostInput}
                        onChange={(event) => setRewardCostInput(event.target.value)}
                        aria-label="悬赏树叶数"
                    />
                    <span>树叶</span>
                    <small>发布后立即扣除，未采纳或删除均不返还；可用数额以账户余额为准。</small>
                </div>
            )}
            <div className="composer-footer">
                <div className="composer-tools">
                    <TagPicker
                        tags={tags}
                        value={label}
                        onChange={setLabel}
                        icon={<HashtagRegular size={19} />}
                        placeholder="标签"
                        emptyLabel="不添加标签"
                        ariaLabel="发布标签"
                        className="composer-tag-picker"
                    />
                    <button
                        type="button"
                        className="composer-tool"
                        title="添加图片"
                        onClick={() => inputRef.current?.click()}>
                        <PicRegular size={19} />
                        <span>图片</span>
                    </button>
                    <button
                        type="button"
                        className={`composer-tool ${bountyEnabled ? 'active' : ''}`}
                        aria-pressed={bountyEnabled}
                        title={bountyEnabled ? '取消悬赏' : '发布悬赏树洞'}
                        onClick={() => setBountyEnabled((enabled) => !enabled)}>
                        <CoinRegular size={19} />
                        <span>悬赏</span>
                    </button>
                    <input
                        ref={inputRef}
                        className="visually-hidden"
                        type="file"
                        accept="image/jpeg,image/png,image/gif"
                        onChange={(event) => setImage(event.target.files?.[0])}
                    />
                    <PostingIdentityControls
                        identities={identities}
                        exclusiveId={exclusiveId}
                        identityTypes={identityTypes}
                        onExclusiveIdChange={setExclusiveId}
                        onIdentityTypesChange={setIdentityTypes}
                        onNotice={onNotice}
                    />
                </div>
                <div className="composer-submit-area">
                    {text.length > 0 && <span>{text.length}/5000</span>}
                    <button type="submit" className="primary-button" disabled={busy || (!text.trim() && !image)}>
                        {busy ? <Loading3Regular className="spin" size={16} /> : <SendRegular size={16} />}
                        发布
                    </button>
                </div>
            </div>
        </form>
    );
}
