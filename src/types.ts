export interface Tag {
  id: number;
  tag_name: string;
}

export interface TagNode {
  id: number;
  tag_name?: string;
  name?: string;
  children?: TagNode[];
}

export interface BookmarkGroup {
  id: number;
  bookmark_name: string;
  hole_count?: number;
}

export type NotificationType = "int_msg" | "sys_msg";

export interface NotificationMessage {
  id: number;
  pid?: number;
  type?: number;
  timestamp?: number | string;
  content?: string;
  is_read?: boolean | 0 | 1;
  body?: {
    type?: number;
    cid?: number;
    contents?: string;
    created_at?: number | string;
    comment_info?: { media_ids?: string };
  };
  hole_info?: Partial<Hole> | Partial<Hole>[];
}

export interface PostingIdentity {
  id: number;
  exclusive_id: string;
  is_v?: 0 | 1;
  audit_status?: string;
}

export interface IdentityInfo {
  department?: string;
  gender?: string;
  level?: string;
}

export interface PublishIdentityOptions {
  exclusiveId?: number;
  exclusiveName?: string;
  identityTypes: number[];
}

export interface Hole {
  pid: number;
  text: string;
  type: "text" | "image";
  timestamp: number;
  likenum: number;
  praise_num?: number;
  praise_num_show?: number;
  is_praise?: 0 | 1;
  reply: number;
  is_follow: 0 | 1;
  is_top?: 0 | 1;
  label_info?: Tag;
  tag?: string;
  bookmark?: {
    bookmark?: BookmarkGroup;
  };
  children_pid?: number | string;
  children?: Hole;
  mention?: number | string;
  mentionInfo?: Hole;
  exclusive_id_id?: number;
  exclusive_id_info?: { exclusive_id?: string };
  identity_info?: IdentityInfo;
  media_ids?: string;
  attention_info?: {
    bookmark_id?: number;
    bookmark_info?: BookmarkGroup;
  };
}

export interface TreeholeComment {
  cid: number;
  pid: number;
  text: string;
  name?: string;
  name_tag?: string;
  timestamp: number;
  quote?: { name_tag: string; text: string };
  type?: "text" | "image";
  likenum?: number;
  is_follow?: 0 | 1;
  media_ids?: string;
  exclusive_id_id?: number;
  exclusive_id_info?: { exclusive_id?: string };
  identity_info?: IdentityInfo;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  lastPage: number;
}

export type FeedMode = "latest" | "bookmarks";
export type CommentViewMode = "modal" | "inline";
export type ThemeMode = "system" | "light" | "dark";
