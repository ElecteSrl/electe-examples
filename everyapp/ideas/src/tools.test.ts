import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { callTool, listTools } from "@every-app/sdk/testing";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

// The tools called the way the Gateway calls them for an AI client: each
// with an identity minted for the one call, through the SDK's tools
// endpoint, which checks the caller's scopes and the input. The same
// in-memory SQLite as ideas.test.ts stands in for D1.
const testDb = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/db", () => ({
  get db() {
    return testDb.current;
  },
}));

const { tools } = await import("./tools");

const fabio = {
  id: "u_fabio",
  email: "fabio.lauria@electe.net",
  orgId: "org_electe",
};
const anne = { id: "u_anne", email: "anne@electe.net", orgId: "org_electe" };
const mallory = {
  id: "u_mallory",
  email: "mallory@other.example",
  orgId: "org_other",
};

beforeAll(async () => {
  const db = drizzle(createClient({ url: ":memory:" }), { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
  testDb.current = db;
});

beforeEach(async () => {
  await (testDb.current as ReturnType<typeof drizzle>).delete(schema.ideas);
});

/** The JSON a successful tool call put in its text block. */
async function ok(
  name: string,
  args: Record<string, unknown>,
  user: { id: string; email: string; orgId: string },
) {
  const response = await callTool(tools, name, args, { user });
  // A refusal is { error }, a call that ran is { result }: narrow, don't cast.
  if (!("result" in response)) {
    throw new Error(`${name} was refused: ${JSON.stringify(response)}`);
  }
  const { result } = response;
  expect(result.isError, JSON.stringify(result)).toBeFalsy();
  const first = result.content[0];
  if (!first || first.type !== "text" || typeof first.text !== "string") {
    throw new Error(`${name} answered no text: ${JSON.stringify(result)}`);
  }
  return JSON.parse(first.text);
}

describe("tools", () => {
  it("lists the three tools with their risk, and no delete", async () => {
    const { tools: listed } = await listTools(tools);
    expect(listed.map(({ name, risk }) => [name, risk])).toEqual([
      ["add_idea", "write"],
      ["list_ideas", "read"],
      ["move_idea", "write"],
    ]);
  });

  it("describes each tool's input for the model", async () => {
    const { tools: listed } = await listTools(tools);
    const add = listed.find((tool) => tool.name === "add_idea");
    expect(add?.inputSchema).toMatchObject({
      type: "object",
      required: expect.arrayContaining(["title", "channel"]),
      properties: {
        channel: { enum: ["linkedin", "x", "newsletter", "blog"] },
      },
      additionalProperties: false,
    });
  });

  it("adds an idea as the person the connection acts for", async () => {
    const idea = await ok(
      "add_idea",
      { title: "From Claude", channel: "linkedin" },
      anne,
    );

    expect(idea).toMatchObject({
      title: "From Claude",
      status: "idea",
      addedBy: "anne@electe.net",
      changedBy: "anne@electe.net",
    });
    expect(idea).not.toHaveProperty("orgId");
  });

  it("shares one board between colleagues and keeps other organizations out", async () => {
    await ok("add_idea", { title: "Fabio's", channel: "blog" }, fabio);

    const seenByAnne = await ok("list_ideas", {}, anne);
    expect(seenByAnne.map((i: { title: string }) => i.title)).toEqual([
      "Fabio's",
    ]);

    expect(await ok("list_ideas", {}, mallory)).toEqual([]);
  });

  it("filters the list by status and channel", async () => {
    await ok("add_idea", { title: "A", channel: "x", status: "draft" }, fabio);
    await ok("add_idea", { title: "B", channel: "blog" }, fabio);

    const drafts = await ok("list_ideas", { status: "draft" }, anne);
    expect(drafts.map((i: { title: string }) => i.title)).toEqual(["A"]);
    const blog = await ok("list_ideas", { channel: "blog" }, anne);
    expect(blog.map((i: { title: string }) => i.title)).toEqual(["B"]);
  });

  it("moves an idea and records who moved it", async () => {
    const { id } = await ok(
      "add_idea",
      { title: "Move me", channel: "x" },
      fabio,
    );

    const moved = await ok("move_idea", { id, status: "scheduled" }, anne);

    expect(moved).toMatchObject({
      status: "scheduled",
      addedBy: "fabio.lauria@electe.net",
      changedBy: "anne@electe.net",
    });
  });

  it("tells the model when an id is unknown, or belongs to another organization", async () => {
    const { id } = await ok("add_idea", { title: "Ours", channel: "x" }, fabio);

    for (const [who, target] of [
      [fabio, crypto.randomUUID()],
      [mallory, id],
    ] as const) {
      const response = await callTool(
        tools,
        "move_idea",
        { id: target, status: "posted" },
        { user: who },
      );
      expect(response).toMatchObject({
        result: { isError: true, content: [{ text: "No idea with that id" }] },
      });
    }
    // Still where it was.
    expect((await ok("list_ideas", {}, fabio))[0].status).toBe("idea");
  });

  it("refuses arguments the schema does not list, so no org or author can be supplied", async () => {
    for (const extra of [
      { orgId: "org_other" },
      { addedBy: "ceo@electe.net" },
    ]) {
      const response = await callTool(
        tools,
        "add_idea",
        { title: "Sneaky", channel: "x", ...extra },
        { user: fabio },
      );
      expect(response, JSON.stringify(extra)).toMatchObject({
        error: { code: "invalid_arguments" },
      });
    }
    expect(await ok("list_ideas", {}, fabio)).toEqual([]);
  });

  it("refuses a bad channel, status, date or id", async () => {
    const bad: [string, Record<string, unknown>][] = [
      ["add_idea", { title: "A", channel: "tiktok" }],
      ["add_idea", { title: "A", channel: "x", targetDate: "2026-02-30" }],
      ["list_ideas", { status: "done" }],
      ["move_idea", { id: "not-a-uuid", status: "draft" }],
    ];
    for (const [name, args] of bad) {
      const response = await callTool(tools, name, args, { user: fabio });
      expect(response, name + JSON.stringify(args)).toMatchObject({
        error: { code: "invalid_arguments" },
      });
    }
    expect(await ok("list_ideas", {}, fabio)).toEqual([]);
  });

  it("refuses a caller whose connection may only read, but lets it read", async () => {
    for (const [name, args] of [
      ["add_idea", { title: "Nope", channel: "x" }],
      ["move_idea", { id: crypto.randomUUID(), status: "draft" }],
    ] as const) {
      const response = await callTool(tools, name, args, {
        scopes: ["mcp:read"],
      });
      expect(response, name).toMatchObject({ error: { code: "forbidden" } });
    }
    const read = await callTool(
      tools,
      "list_ideas",
      {},
      { scopes: ["mcp:read"] },
    );
    expect(read).toMatchObject({ result: { content: [{ text: "[]" }] } });
  });
});
