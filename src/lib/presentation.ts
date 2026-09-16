import { displayText } from '../normalize';
import type { NotificationMessage, TreeholeComment } from '../types';

export function commentSender(comment: TreeholeComment) {
    return displayText(comment.name || comment.name_tag) || '洞友';
}

export function formatTime(timestamp: number) {
    const seconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp));
    if (seconds < 60) return '刚刚';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
    if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)} 天前`;
    return fullTime(timestamp);
}

export function fullTime(timestamp: number) {
    const date = new Date(timestamp * 1000);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function messageTimestamp(value?: number | string) {
    if (typeof value === 'number') return value > 1e12 ? Math.floor(value / 1000) : value;
    if (!value) return 0;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric > 1e12 ? Math.floor(numeric / 1000) : numeric;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
}

export function notificationHole(message: NotificationMessage) {
    const info = Array.isArray(message.hole_info) ? message.hole_info[0] : message.hole_info;
    return info?.pid ? info : undefined;
}
