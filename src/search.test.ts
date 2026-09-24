import { describe, expect, it } from "vitest";
import { matchesAdvancedQuery, parseQuery } from "./search";

describe("parseQuery", () => {
  it("keeps space-separated keywords for the API and parses excluded terms", () => {
    const query = parseQuery('人工智能 machine learning 北大 -:广告');
    expect(query.baseQuery).toBe("人工智能 machine learning 北大");
    expect(query.includes).toEqual([]);
    expect(query.excludes).toEqual(["广告"]);
    expect(query.backendQuery).toBe("人工智能 machine learning 北大");
  });

  it("supports an exclusion-only query", () => {
    expect(parseQuery("-:求购").backendQuery).toBe("");
  });

  it("recognizes direct pid searches", () => {
    const query = parseQuery("#39403877");
    expect(query.pid).toBe(39403877);
    expect(query.backendQuery).toBe("39403877");
  });

  it("splits OR searches with a pipe and normalizes each backend query", () => {
    const query = parseQuery("人工智能 | machine learning | #39403877 -:广告");
    expect(query.orQueries).toEqual(["人工智能", "machine learning", "#39403877"]);
    expect(query.backendQueries).toEqual(["人工智能", "machine learning", "39403877"]);
    expect(query.baseQuery).toBe("人工智能 | machine learning | #39403877");
    expect(query.excludes).toEqual(["广告"]);
    expect(query.hasAdvanced).toBe(true);
    expect(query.pid).toBeUndefined();
  });

  it("ignores empty and duplicate OR branches", () => {
    const query = parseQuery("AI | | ai | 机器学习");
    expect(query.orQueries).toEqual(["AI", "机器学习"]);
    expect(query.backendQueries).toEqual(["AI", "机器学习"]);
  });

  it("splits OR searches with full-width and mixed pipes", () => {
    const query = parseQuery("人工智能｜machine learning | #39403877 -:广告");
    expect(query.orQueries).toEqual(["人工智能", "machine learning", "#39403877"]);
    expect(query.backendQueries).toEqual(["人工智能", "machine learning", "39403877"]);
    expect(query.baseQuery).toBe("人工智能 | machine learning | #39403877");
    expect(query.excludes).toEqual(["广告"]);
    expect(query.hasAdvanced).toBe(true);
  });

  it("normalizes width and case while filtering", () => {
    const query = parseQuery("ＡＩ -:广告");
    expect(matchesAdvancedQuery("AI 学习讨论", query)).toBe(true);
    expect(matchesAdvancedQuery("AI 课程广告", query)).toBe(false);
  });
});
