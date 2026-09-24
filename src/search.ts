export interface ParsedQuery {
  source: string;
  hasAdvanced: boolean;
  baseQuery: string;
  orQueries: string[];
  includes: string[];
  excludes: string[];
  normalizedIncludes: string[];
  normalizedExcludes: string[];
  backendQuery: string;
  backendQueries: string[];
  pid?: number;
}

export function normalizeSearchText(value: unknown) {
  const text = String(value ?? "");
  try {
    return text.normalize("NFKC").toLocaleLowerCase();
  } catch {
    return text.toLocaleLowerCase();
  }
}

function unescapeQuotedValue(value: string) {
  return value.replace(/\\(["'\\])/g, "$1");
}

function uniqueTerms(terms: string[]) {
  const seen = new Set<string>();
  return terms.filter((term) => {
    const key = normalizeSearchText(term);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseQuery(source: string): ParsedQuery {
  const input = String(source ?? "");
  const excludes: string[] = [];
  const baseParts: string[] = [];
  const pattern = /(^|\s)-:(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|(\S+))/g;
  let foundOperator = false;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    foundOperator = true;
    baseParts.push(input.slice(lastIndex, match.index));
    const value = unescapeQuotedValue(match[2] ?? match[3] ?? match[4] ?? "").trim();
    if (value) excludes.push(value);
    lastIndex = pattern.lastIndex;
  }

  baseParts.push(input.slice(lastIndex));
  const orQueries = uniqueTerms(
    baseParts
      .join(" ")
      .split(/[|｜]/)
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter(Boolean),
  );
  const baseQuery = orQueries.join(" | ");
  const excludedTerms = uniqueTerms(excludes);
  const directPid = orQueries.length === 1 ? orQueries[0].match(/^#?(\d+)$/) : null;
  const backendQueries = orQueries.length
    ? orQueries.map((query) => query.match(/^#?(\d+)$/)?.[1] ?? query)
    : [""];

  return {
    source: input,
    hasAdvanced: foundOperator || orQueries.length > 1,
    baseQuery,
    orQueries,
    includes: [],
    excludes: excludedTerms,
    normalizedIncludes: [],
    normalizedExcludes: excludedTerms.map(normalizeSearchText),
    // A typed PID remains a keyword search so the API can return both the
    // original hole and holes that reference it. Exact navigation is handled
    // separately by the UI.
    backendQuery: backendQueries[0],
    backendQueries,
    pid: directPid ? Number(directPid[1]) : undefined,
  };
}

export function matchesAdvancedQuery(text: string, query: ParsedQuery) {
  const normalized = normalizeSearchText(text);
  return (
    query.normalizedIncludes.every((term) => normalized.includes(term)) &&
    !query.normalizedExcludes.some((term) => normalized.includes(term))
  );
}
