import { describe, expect, it } from "vitest";
import {
  COMMENT_COLOR_COUNT,
  commentColorIndex,
  commentColorToken,
} from "./commentColors";

const TREEHOLE_NAMES = [
  "Alice", "Bob", "Carol", "Dave", "Eve", "Francis", "Grace", "Hans",
  "Isabella", "Jason", "Kate", "Louis", "Margaret", "Nathan", "Olivia",
  "Paul", "Queen", "Richard", "Susan", "Thomas", "Uma", "Vivian",
  "Winnie", "Xander", "Yasmine", "Zach",
];

describe("comment color assignment", () => {
  it("maps the anonymous names by their A-Z order", () => {
    expect(commentColorIndex("Alice")).toBe(0);
    expect(commentColorIndex("Bob")).toBe(1);
    expect(commentColorIndex("Carol")).toBe(2);
    expect(commentColorIndex("Isabella")).toBe(0);
  });

  it("separates every pair of alphabetically neighboring Treehole names", () => {
    for (let index = 1; index < TREEHOLE_NAMES.length; index += 1) {
      expect(commentColorIndex(TREEHOLE_NAMES[index]))
        .not.toBe(commentColorIndex(TREEHOLE_NAMES[index - 1]));
    }
  });

  it("is stable across case and surrounding whitespace", () => {
    expect(commentColorIndex(" alice ")).toBe(commentColorIndex("Alice"));
    expect(commentColorIndex("Ｂob")).toBe(commentColorIndex("Bob"));
  });

  it("produces deterministic, valid fallback tokens", () => {
    const index = commentColorIndex("洞主");
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(COMMENT_COLOR_COUNT);
    expect(commentColorToken(index)).toBe(`var(--comment-name-${index})`);
  });
});
