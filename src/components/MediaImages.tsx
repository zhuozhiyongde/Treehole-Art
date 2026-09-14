import { useEffect, useState } from 'react';
import { fetchCommentImage, fetchHoleImage } from '../api';

export function PostImage({ pid }: { pid: number }) {
    const [url, setUrl] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        let objectUrl = '';
        fetchHoleImage(pid, controller.signal)
            .then((nextUrl) => {
                objectUrl = nextUrl;
                setUrl(nextUrl);
            })
            .catch(() => undefined);
        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [pid]);
    return url ? <img className="post-image" src={url} alt={`洞 ${pid} 的配图`} /> : null;
}

function MediaImage({ mediaId, className, alt }: { mediaId: number; className: string; alt: string }) {
    const [url, setUrl] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        let objectUrl = '';
        fetchCommentImage(mediaId, controller.signal)
            .then((nextUrl) => {
                objectUrl = nextUrl;
                setUrl(nextUrl);
            })
            .catch(() => undefined);
        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [mediaId]);
    return url ? <img className={className} src={url} alt={alt} /> : null;
}

export function MediaImages({ mediaIds, variant }: { mediaIds?: string; variant: 'post' | 'comment' }) {
    const ids = String(mediaIds ?? '')
        .split(',')
        .map(Number)
        .filter((id) => Number.isSafeInteger(id) && id > 0);
    if (!ids.length) return null;
    return (
        <div className={`${variant}-media-list`}>
            {ids.map((id, index) => (
                <MediaImage
                    mediaId={id}
                    className={variant === 'post' ? 'post-image' : 'comment-image'}
                    alt={variant === 'post' ? `树洞配图 ${index + 1}` : `评论配图 ${index + 1}`}
                    key={id}
                />
            ))}
        </div>
    );
}

