import {
    CloseRegular,
    FullscreenRegular,
    ZoomInRegular,
    ZoomOutRegular,
} from '@mingcute/react/core-regular';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchCommentImage, fetchHoleImage } from '../api';

const MIN_LIGHTBOX_ZOOM = 0.25;
const MAX_LIGHTBOX_ZOOM = 8;
const LIGHTBOX_ZOOM_STEP = 0.25;

type ImageSize = {
    width: number;
    height: number;
};

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
    const [fitSize, setFitSize] = useState<ImageSize>();
    const [zoom, setZoom] = useState(1);
    const imageRef = useRef<HTMLImageElement>(null);
    const lightboxScrollRef = useRef<HTMLDivElement>(null);
    const lightboxStageRef = useRef<HTMLDivElement>(null);
    const naturalSizeRef = useRef<ImageSize | undefined>(undefined);
    const zoomRef = useRef(1);

    const updateFitSize = useCallback(() => {
        const scrollArea = lightboxScrollRef.current;
        const stage = lightboxStageRef.current;
        const naturalSize = naturalSizeRef.current;
        if (!scrollArea || !stage || !naturalSize) return;

        const stageStyle = window.getComputedStyle(stage);
        const horizontalPadding = Number.parseFloat(stageStyle.paddingLeft) + Number.parseFloat(stageStyle.paddingRight);
        const verticalPadding = Number.parseFloat(stageStyle.paddingTop) + Number.parseFloat(stageStyle.paddingBottom);
        const availableWidth = Math.max(1, scrollArea.clientWidth - horizontalPadding);
        const availableHeight = Math.max(1, scrollArea.clientHeight - verticalPadding);
        const fitScale = Math.min(availableWidth / naturalSize.width, availableHeight / naturalSize.height);
        const nextSize = {
            width: Math.max(1, Math.round(naturalSize.width * fitScale)),
            height: Math.max(1, Math.round(naturalSize.height * fitScale)),
        };
        setFitSize((current) =>
            current?.width === nextSize.width && current.height === nextSize.height ? current : nextSize,
        );
    }, []);

    const openLightbox = () => {
        naturalSizeRef.current = undefined;
        setFitSize(undefined);
        setLightboxUrl(src);
        zoomRef.current = 1;
        setZoom(1);
        setOpen(true);
    };

    const setZoomAround = useCallback(
        (requestedZoom: number, clientX?: number, clientY?: number) => {
            const nextZoom = Math.min(MAX_LIGHTBOX_ZOOM, Math.max(MIN_LIGHTBOX_ZOOM, requestedZoom));
            if (nextZoom === zoomRef.current) return;

            const scrollArea = lightboxScrollRef.current;
            if (!scrollArea) {
                zoomRef.current = nextZoom;
                setZoom(nextZoom);
                return;
            }

            const bounds = scrollArea.getBoundingClientRect();
            const originX = clientX === undefined ? scrollArea.clientWidth / 2 : clientX - bounds.left;
            const originY = clientY === undefined ? scrollArea.clientHeight / 2 : clientY - bounds.top;
            const horizontalPosition = (scrollArea.scrollLeft + originX) / scrollArea.scrollWidth;
            const verticalPosition = (scrollArea.scrollTop + originY) / scrollArea.scrollHeight;

            zoomRef.current = nextZoom;
            setZoom(nextZoom);
            window.requestAnimationFrame(() => {
                scrollArea.scrollLeft = horizontalPosition * scrollArea.scrollWidth - originX;
                scrollArea.scrollTop = verticalPosition * scrollArea.scrollHeight - originY;
            });
        },
        [],
    );

    useEffect(() => {
        if (!open) return;
        document.body.classList.add('image-lightbox-open');
        const handleKeyboard = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                setOpen(false);
                window.requestAnimationFrame(() => imageRef.current?.focus());
                return;
            }
            if (event.key === '+' || event.key === '=') {
                event.preventDefault();
                setZoomAround(zoomRef.current + LIGHTBOX_ZOOM_STEP);
            } else if (event.key === '-') {
                event.preventDefault();
                setZoomAround(zoomRef.current - LIGHTBOX_ZOOM_STEP);
            } else if (event.key === '0') {
                event.preventDefault();
                setZoomAround(1);
            }
        };
        document.addEventListener('keydown', handleKeyboard, true);
        return () => {
            document.body.classList.remove('image-lightbox-open');
            document.removeEventListener('keydown', handleKeyboard, true);
        };
    }, [open, setZoomAround]);

    useEffect(() => {
        if (!open) return;
        const scrollArea = lightboxScrollRef.current;
        if (!scrollArea) return;
        updateFitSize();
        const resizeObserver = new ResizeObserver(updateFitSize);
        resizeObserver.observe(scrollArea);
        const handleWheel = (event: WheelEvent) => {
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            setZoomAround(
                zoomRef.current + (event.deltaY < 0 ? LIGHTBOX_ZOOM_STEP : -LIGHTBOX_ZOOM_STEP),
                event.clientX,
                event.clientY,
            );
        };
        scrollArea.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            resizeObserver.disconnect();
            scrollArea.removeEventListener('wheel', handleWheel);
        };
    }, [open, setZoomAround, updateFitSize]);

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
                naturalSizeRef.current = undefined;
                setFitSize(undefined);
                zoomRef.current = 1;
                setZoom(1);
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
                    openLightbox();
                }}
                onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    event.stopPropagation();
                    openLightbox();
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
                        <div
                            ref={lightboxScrollRef}
                            className="image-lightbox-scroll"
                            onClick={(event) => {
                                event.stopPropagation();
                                if (event.target === event.currentTarget) close();
                            }}>
                            <div
                                ref={lightboxStageRef}
                                className="image-lightbox-stage"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (event.target === event.currentTarget) close();
                                }}>
                                <img
                                    className={`image-lightbox-image ${fitSize ? 'is-ready' : ''}`}
                                    src={lightboxUrl}
                                    alt={alt}
                                    draggable={false}
                                    style={
                                        fitSize
                                            ? {
                                                  width: `${Math.round(fitSize.width * zoom)}px`,
                                                  height: `${Math.round(fitSize.height * zoom)}px`,
                                              }
                                            : undefined
                                    }
                                    onLoad={(event) => {
                                        naturalSizeRef.current = {
                                            width: event.currentTarget.naturalWidth,
                                            height: event.currentTarget.naturalHeight,
                                        };
                                        zoomRef.current = 1;
                                        setZoom(1);
                                        updateFitSize();
                                    }}
                                    onDoubleClick={(event) => {
                                        event.stopPropagation();
                                        setZoomAround(zoom === 1 ? 2 : 1, event.clientX, event.clientY);
                                    }}
                                    onClick={(event) => event.stopPropagation()}
                                />
                            </div>
                        </div>
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
                        <div className="image-lightbox-toolbar" role="group" aria-label="图片缩放">
                            <button
                                type="button"
                                aria-label="缩小图片"
                                title="缩小（-）"
                                disabled={zoom <= MIN_LIGHTBOX_ZOOM}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setZoomAround(zoom - LIGHTBOX_ZOOM_STEP);
                                }}>
                                <ZoomOutRegular size={21} />
                            </button>
                            <button
                                type="button"
                                className="image-lightbox-fit"
                                aria-label="使图片适应窗口"
                                title="适应窗口（0）"
                                disabled={zoom === 1}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setZoomAround(1);
                                }}>
                                <FullscreenRegular size={19} />
                                <span>{Math.round(zoom * 100)}%</span>
                            </button>
                            <button
                                type="button"
                                aria-label="放大图片"
                                title="放大（+）"
                                disabled={zoom >= MAX_LIGHTBOX_ZOOM}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setZoomAround(zoom + LIGHTBOX_ZOOM_STEP);
                                }}>
                                <ZoomInRegular size={21} />
                            </button>
                        </div>
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
