import type { Hole } from '../types';

export function withoutBookmarkGroup(hole: Hole, bookmarkId: number): Hole {
    const currentId = hole.bookmark?.bookmark?.id ?? hole.attention_info?.bookmark_id;
    if (currentId !== bookmarkId) return hole;
    return {
        ...hole,
        bookmark: undefined,
        attention_info: {
            ...hole.attention_info,
            bookmark_id: undefined,
            bookmark_info: undefined,
        },
    };
}
