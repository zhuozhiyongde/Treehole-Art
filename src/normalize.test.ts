import { describe, expect, it } from "vitest";
import { displayText, normalizeComment, resolveCommentTotal } from "./normalize";
import type { TreeholeComment } from "./types";

const baseComment: TreeholeComment = {
  cid: 1,
  pid: 2,
  text: "正文",
  name_tag: "洞主",
  timestamp: 1,
};

describe("normalizeComment", () => {
  it("treats the API's empty quote array as no quote", () => {
    const comment = normalizeComment({
      ...baseComment,
      quote: [] as unknown as TreeholeComment["quote"],
    });

    expect(comment.quote).toBeUndefined();
    expect(comment.name).toBe("洞主");
  });

  it("preserves a valid quote", () => {
    const quote = { name_tag: "Alice", text: "被引用内容" };
    expect(normalizeComment({ ...baseComment, quote }).quote).toEqual(quote);
  });

  it("normalizes the accepted-answer flag returned by the API", () => {
    const comment = normalizeComment({
      ...baseComment,
      reward_good: "1" as unknown as TreeholeComment["reward_good"],
    });

    expect(comment.reward_good).toBe(1);
  });

  it("normalizes the hole-owner flag used by bounty actions", () => {
    const comment = normalizeComment({
      ...baseComment,
      is_lz: "0" as unknown as TreeholeComment["is_lz"],
    });

    expect(comment.is_lz).toBe(0);
  });
});

describe("displayText", () => {
  it("turns missing display values into safe text", () => {
    expect(displayText(undefined)).toBe("");
    expect(displayText(null)).toBe("");
    expect(displayText(42)).toBe("42");
  });
});

describe("resolveCommentTotal", () => {
  it("uses the post reply count instead of the comment endpoint page size", () => {
    expect(resolveCommentTotal(1, 1, 15, 1)).toBe(1);
  });

  it("does not undercount comments that have already been loaded", () => {
    expect(resolveCommentTotal(15, 2, 15, 3)).toBe(18);
  });
});
