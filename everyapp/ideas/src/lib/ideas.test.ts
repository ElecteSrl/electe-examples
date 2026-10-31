import { describe, expect, it } from "vitest";
import { displayName, formatDay, formatInstant } from "./format";
import {
  createIdeaInput,
  isCalendarDate,
  moveIdeaInput,
  parseInput,
  updateIdeaInput,
} from "./ideas";

const id = "0b6f7a4e-6c1f-4f5f-9d0e-2f1f2c3d4e5f";

describe("isCalendarDate", () => {
  it("accepts a real day and refuses everything else", () => {
    expect(isCalendarDate("2026-11-05")).toBe(true);
    expect(isCalendarDate("2028-02-29")).toBe(true);
    for (const bad of [
      "2026-02-30",
      "2026-13-01",
      "2026-1-5",
      "05/11/2026",
      "",
      "tomorrow",
    ]) {
      expect(isCalendarDate(bad), bad).toBe(false);
    }
  });
});

describe("the input schemas", () => {
  it("trim the text and need a title and a channel", () => {
    expect(createIdeaInput.parse({ title: "  Hello  ", channel: "x" })).toEqual(
      {
        title: "Hello",
        channel: "x",
      },
    );
    expect(
      createIdeaInput.safeParse({ title: "   ", channel: "x" }).success,
    ).toBe(false);
    expect(createIdeaInput.safeParse({ title: "Hello" }).success).toBe(false);
  });

  it("refuse an unknown channel, status or date", () => {
    expect(
      createIdeaInput.safeParse({ title: "A", channel: "tiktok" }).success,
    ).toBe(false);
    expect(
      createIdeaInput.safeParse({ title: "A", channel: "x", status: "done" })
        .success,
    ).toBe(false);
    expect(
      createIdeaInput.safeParse({
        title: "A",
        channel: "x",
        targetDate: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      createIdeaInput.safeParse({ title: "A", channel: "x", targetDate: null })
        .success,
    ).toBe(true);
  });

  it("refuse a field nobody listed, such as an organization or an author", () => {
    for (const extra of [
      { orgId: "org_x" },
      { addedBy: "someone@else.net" },
      { id },
    ]) {
      expect(
        createIdeaInput.safeParse({ title: "A", channel: "x", ...extra })
          .success,
      ).toBe(false);
    }
    expect(
      moveIdeaInput.safeParse({ id, status: "draft", orgId: "org_x" }).success,
    ).toBe(false);
  });

  it("need a real id, and an update needs something to change", () => {
    expect(
      moveIdeaInput.safeParse({ id: "1; drop table ideas", status: "draft" })
        .success,
    ).toBe(false);
    expect(updateIdeaInput.safeParse({ id }).success).toBe(false);
    expect(updateIdeaInput.safeParse({ id, targetDate: null }).success).toBe(
      true,
    );
  });

  it("cap the lengths", () => {
    expect(
      createIdeaInput.safeParse({ title: "x".repeat(121), channel: "x" })
        .success,
    ).toBe(false);
    expect(
      createIdeaInput.safeParse({
        title: "A",
        note: "x".repeat(501),
        channel: "x",
      }).success,
    ).toBe(false);
  });
});

describe("parseInput", () => {
  it("throws one readable sentence, not a JSON dump", () => {
    expect(() =>
      parseInput(createIdeaInput, { title: "", channel: "x" }),
    ).toThrow("Give the idea a title");
  });
});

describe("format", () => {
  it("reads a name from the signed-in e-mail", () => {
    expect(displayName("fabio.lauria@electe.net")).toBe("Fabio Lauria");
    expect(displayName("anne@electe.net")).toBe("Anne");
    expect(displayName("a_b-c@x.net")).toBe("A B C");
    expect(displayName("@x.net")).toBe("@x.net");
  });

  it("writes a day without a time zone shifting it", () => {
    expect(formatDay("2026-11-05")).toBe("Thu 5 Nov 2026");
    expect(formatDay("2026-01-01")).toBe("Thu 1 Jan 2026");
  });

  it("writes an instant in the time zone asked for", () => {
    expect(formatInstant("2026-11-01T23:30:00.000Z", "UTC")).toBe("1 Nov 2026");
    expect(formatInstant("2026-11-01T23:30:00.000Z", "Europe/Rome")).toBe(
      "2 Nov 2026",
    );
  });
});
