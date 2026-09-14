export const COMMENT_COLOR_COUNT = 8;

function nameHash(name: string) {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

/**
 * Treehole's anonymous names run alphabetically from Alice through Zach.
 * Mapping the initial A-Z position onto a deliberately contrast-ordered
 * palette keeps alphabetic neighbors stable and visually distinct.
 */
export function commentColorIndex(name = "洞友") {
  const normalizedName = name.normalize("NFKC").trim();
  const latinInitial = normalizedName.match(/[a-z]/i)?.[0];
  if (latinInitial) {
    return (latinInitial.toUpperCase().charCodeAt(0) - 65) % COMMENT_COLOR_COUNT;
  }
  return nameHash(normalizedName || "洞友") % COMMENT_COLOR_COUNT;
}

export function commentColorToken(index: number) {
  const safeIndex = Number.isInteger(index)
    ? ((index % COMMENT_COLOR_COUNT) + COMMENT_COLOR_COUNT) % COMMENT_COLOR_COUNT
    : 0;
  return `var(--comment-name-${safeIndex})`;
}
