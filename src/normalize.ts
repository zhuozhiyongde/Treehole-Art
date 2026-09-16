import type { TreeholeComment } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function displayText(value: unknown) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

export function normalizeComment(comment: TreeholeComment): TreeholeComment {
  const rawQuote: unknown = comment.quote;
  const quote = isRecord(rawQuote)
    && typeof rawQuote.name_tag === "string"
    && typeof rawQuote.text === "string"
    ? { name_tag: rawQuote.name_tag, text: rawQuote.text }
    : undefined;
  const name = displayText(comment.name || comment.name_tag);

  return {
    ...comment,
    text: displayText(comment.text),
    name: name || undefined,
    quote,
    reward_good:
      comment.reward_good === undefined
        ? undefined
        : Number(comment.reward_good) === 1
          ? 1
          : 0,
    is_lz:
      comment.is_lz === undefined
        ? undefined
        : Number(comment.is_lz) === 1
          ? 1
          : 0,
  };
}

export function resolveCommentTotal(
  replyCount: number,
  page: number,
  pageSize: number,
  loadedCount: number,
) {
  const declaredTotal = Number.isFinite(replyCount) ? Math.max(0, Math.trunc(replyCount)) : 0;
  const loadedThrough = Math.max(0, page - 1) * pageSize + loadedCount;
  return Math.max(declaredTotal, loadedThrough);
}
