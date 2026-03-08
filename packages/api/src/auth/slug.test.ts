import { describe, expect, it } from "vitest";
import { generateSlug, validateSlug } from "./slug.ts";

describe("validateSlug", () => {
  it("accepts a valid slug", () => {
    expect(validateSlug("my-team")).toEqual({ valid: true });
  });

  it("accepts a short numeric slug", () => {
    expect(validateSlug("abc")).toEqual({ valid: true });
  });

  it("rejects too short", () => {
    expect(validateSlug("ab")).toEqual({ valid: false, reason: "too_short" });
  });

  it("rejects too long", () => {
    expect(validateSlug("a".repeat(49))).toEqual({ valid: false, reason: "too_long" });
  });

  it("rejects invalid characters", () => {
    expect(validateSlug("My Team")).toEqual({ valid: false, reason: "invalid_characters" });
  });

  it("rejects leading hyphens", () => {
    expect(validateSlug("-abc")).toEqual({ valid: false, reason: "invalid_characters" });
  });

  it("rejects trailing hyphens", () => {
    expect(validateSlug("abc-")).toEqual({ valid: false, reason: "invalid_characters" });
  });

  it("rejects consecutive hyphens", () => {
    expect(validateSlug("abc--def")).toEqual({ valid: false, reason: "invalid_characters" });
  });

  it("rejects reserved slugs", () => {
    expect(validateSlug("admin")).toEqual({ valid: false, reason: "reserved" });
    expect(validateSlug("api")).toEqual({ valid: false, reason: "reserved" });
    expect(validateSlug("www")).toEqual({ valid: false, reason: "reserved" });
  });
});

describe("generateSlug", () => {
  it("lowercases and replaces non-alphanumeric with hyphens", () => {
    const slug = generateSlug("My Cool Team!");
    expect(slug).toMatch(/^my-cool-team-[0-9a-f]{4}$/);
  });

  it("truncates long names to 40 chars before suffix", () => {
    const slug = generateSlug("a".repeat(60));
    // 40 chars + '-' + 4 hex chars = 45
    expect(slug.length).toBeLessThanOrEqual(45);
  });

  it("handles names that produce empty base", () => {
    const slug = generateSlug("!!!");
    expect(slug).toMatch(/^[0-9a-f]{4}$/);
  });

  it("strips leading and trailing hyphens from the base", () => {
    const slug = generateSlug("  --test--  ");
    expect(slug).toMatch(/^test-[0-9a-f]{4}$/);
  });
});
