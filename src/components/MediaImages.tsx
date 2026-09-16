import { CloseRegular } from '@mingcute/react/core-regular';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchCommentImage, fetchHoleImage } from '../api';

function ZoomableImage({
    src,
    className,
    alt,
    loadOriginal,
}: {
    src: string;
    className: string;
    alt: string;
    loadOriginal?: (signal: AbortSignal) => Promise<string>;
}) {
    const [open, setOpen] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState(src);
    const imageRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (!open) return;
        document.body.classList.add('image-lightbox-open');
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopImmediatePropagation();
            setOpen(false);
            window.requestAnimationFrame(() => imageRef.current?.focus());
        };
        document.addEventListener('keydown', closeOnEscape, true);
        return () => {
            document.body.classList.remove('image-lightbox-open');
            document.removeEventListener('keydown', closeOnEscape, true);
        };
    }, [open]);

    useEffect(() => {
        if (!open || !loadOriginal) {
            setLightboxUrl(src);
            return;
        }
        const controller = new AbortController();
        let objectUrl = '';
        setLightboxUrl(src);
        loadOriginal(controller.signal)
            .then((url) => {
                if (!url) return;
                objectUrl = url;
                setLightboxUrl(url);
            })
            .catch(() => undefined);
        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [loadOriginal, open, src]);

    const close = () => {
        setOpen(false);
        window.requestAnimationFrame(() => imageRef.current?.focus());
    };

    return (
        <>
            <img
                ref={imageRef}
                className={className}
                src={src}
                alt={alt}
                role="button"
                tabIndex={0}
                title="点击放大图片"
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen(true);
                }}
                onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(true);
                }}
            />
            {open &&
                createPortal(
                    <div
                        className="image-lightbox"
                        role="dialog"
                        aria-modal="true"
                        aria-label={alt}
                        onClick={(event) => {
                            event.stopPropagation();
                            if (event.target === event.currentTarget) close();
                        }}>
                        <button
                            type="button"
                            className="image-lightbox-close"
                            aria-label="关闭图片预览"
                            autoFocus
                            onClick={(event) => {
                                event.stopPropagation();
                                close();
                            }}>
                            <CloseRegular size={24} />
                        </button>
                        <img src={lightboxUrl} alt={alt} onClick={(event) => event.stopPropagation()} />
                    </div>,
                    document.body,
                )}
        </>
    );
}

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
    return url ? <ZoomableImage className="post-image" src={url} alt={`洞 ${pid} 的配图`} /> : null;
}

function MediaImage({ mediaId, className, alt }: { mediaId: number; className: string; alt: string }) {
    const [url, setUrl] = useState('');
    const loadOriginal = useCallback(
        (signal: AbortSignal) => fetchCommentImage(mediaId, signal, true),
        [mediaId],
    );
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
    return url ? <ZoomableImage className={className} src={url} alt={alt} loadOriginal={loadOriginal} /> : null;
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
