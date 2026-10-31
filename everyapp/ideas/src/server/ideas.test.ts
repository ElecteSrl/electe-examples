import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as schema from "@/db/schema";

// An in-memory SQLite with the app's migrations stands in for D1.
const testDb = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/db", () => ({
  get db() {
    return testDb.current;
  },
}));

const { createIdea, deleteIdea, listIdeas, moveIdea, updateIdea } =
  await import("./ideas");

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
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
  });
  testDb.current = db;
});

beforeEach(async () => {
  // Each test starts from an empty board; only the clock is faked.
  await (testDb.current as ReturnType<typeof drizzle>).delete(schema.ideas);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T09:00:00.000Z"));
});

afterEach(() => vi.useRealTimers());

describe("adding an idea", () => {
  it("stamps who added it and when from the actor, not from the input", async () => {
    const idea = await createIdea(fabio, {
      title: "Why forecasts show a range",
      channel: "linkedin",
    });

    expect(idea).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      title: "Why forecasts show a range",
      note: "",
      channel: "linkedin",
      status: "idea",
      targetDate: null,
      addedBy: "fabio.lauria@electe.net",
      addedAt: "2026-11-01T09:00:00.000Z",
      changedBy: "fabio.lauria@electe.net",
      changedAt: "2026-11-01T09:00:00.000Z",
    });
    // The organization id never leaves the server.
    expect(idea).not.toHaveProperty("orgId");
  });

  it("keeps the note, the status and the target date when given", async () => {
    const idea = await createIdea(fabio, {
      title: "Q4 numbers thread",
      note: "Open with the surprise",
      channel: "x",
      status: "draft",
      targetDate: "2026-11-05",
    });
    expect(idea).toMatchObject({
      note: "Open with the surprise",
      status: "draft",
      targetDate: "2026-11-05",
    });
  });
});

describe("a shared board", () => {
  it("shows everyone in the organization the same ideas", async () => {
    const mine = await createIdea(fabio, { title: "Fabio's", channel: "blog" });
    const hers = await createIdea(anne, {
      title: "Anne's",
      channel: "newsletter",
    });

    expect((await listIdeas(fabio.orgId)).map((i) => i.id).sort()).toEqual(
      [mine.id, hers.id].sort(),
    );
    expect(await listIdeas(anne.orgId)).toEqual(await listIdeas(fabio.orgId));
  });

  it("lets a colleague change an idea and records who, keeping the author", async () => {
    const idea = await createIdea(fabio, {
      title: "Draft me",
      channel: "blog",
    });
    vi.setSystemTime(new Date("2026-11-02T10:30:00.000Z"));

    const changed = await updateIdea(anne, {
      id: idea.id,
      title: "Draft me, sharper",
    });

    expect(changed).toMatchObject({
      title: "Draft me, sharper",
      addedBy: "fabio.lauria@electe.net",
      addedAt: "2026-11-01T09:00:00.000Z",
      changedBy: "anne@electe.net",
      changedAt: "2026-11-02T10:30:00.000Z",
    });
  });

  it("never lets another organization see, change, move or delete a row", async () => {
    const idea = await createIdea(fabio, {
      title: "Ours",
      channel: "linkedin",
    });

    expect(await listIdeas(mallory.orgId)).toEqual([]);
    expect(
      await updateIdea(mallory, { id: idea.id, title: "Hijacked" }),
    ).toBeNull();
    expect(
      await moveIdea(mallory, { id: idea.id, status: "posted" }),
    ).toBeNull();
    expect(await deleteIdea(mallory.orgId, { id: idea.id })).toBeNull();

    // Untouched for the owners.
    expect(await listIdeas(fabio.orgId)).toEqual([idea]);
  });

  it("writes a new row under the actor's organization, whatever else is in the input", async () => {
    // The input schema is strict, but the query must not depend on it:
    // the organization is the actor's alone.
    const idea = await createIdea(mallory, {
      title: "Theirs",
      channel: "x",
      ...({ orgId: fabio.orgId } as object),
    });
    expect(await listIdeas(fabio.orgId)).toEqual([]);
    expect(await listIdeas(mallory.orgId)).toEqual([idea]);
  });
});

describe("changing an idea", () => {
  it("changes only the fields given and clears the date with null", async () => {
    const idea = await createIdea(fabio, {
      title: "Keep me",
      note: "Keep this too",
      channel: "blog",
      targetDate: "2026-11-10",
    });

    const retitled = await updateIdea(anne, {
      id: idea.id,
      channel: "newsletter",
    });
    expect(retitled).toMatchObject({
      title: "Keep me",
      note: "Keep this too",
      channel: "newsletter",
      targetDate: "2026-11-10",
    });

    const cleared = await updateIdea(anne, { id: idea.id, targetDate: null });
    expect(cleared?.targetDate).toBeNull();
  });

  it("answers null for an id nobody has", async () => {
    expect(
      await updateIdea(fabio, { id: crypto.randomUUID(), title: "Ghost" }),
    ).toBeNull();
  });
});

describe("moving an idea", () => {
  it("moves it and records who moved it and when", async () => {
    const idea = await createIdea(fabio, { title: "Move me", channel: "x" });
    vi.setSystemTime(new Date("2026-11-03T08:00:00.000Z"));

    const moved = await moveIdea(anne, { id: idea.id, status: "draft" });

    expect(moved).toMatchObject({
      status: "draft",
      changedBy: "anne@electe.net",
      changedAt: "2026-11-03T08:00:00.000Z",
    });
  });

  it("changes nothing, and names nobody, when it is already there", async () => {
    const idea = await createIdea(fabio, { title: "Stay", channel: "x" });
    vi.setSystemTime(new Date("2026-11-03T08:00:00.000Z"));

    const same = await moveIdea(anne, { id: idea.id, status: "idea" });

    expect(same).toEqual(idea);
    expect(same?.changedBy).toBe("fabio.lauria@electe.net");
  });

  it("answers null for an id nobody has", async () => {
    expect(
      await moveIdea(fabio, { id: crypto.randomUUID(), status: "posted" }),
    ).toBeNull();
  });
});

describe("deleting an idea", () => {
  it("removes it for the whole organization", async () => {
    const idea = await createIdea(fabio, { title: "Gone", channel: "blog" });
    expect(await deleteIdea(anne.orgId, { id: idea.id })).toMatchObject({
      id: idea.id,
    });
    expect(await listIdeas(fabio.orgId)).toEqual([]);
    expect(await deleteIdea(anne.orgId, { id: idea.id })).toBeNull();
  });
});

describe("listing", () => {
  it("filters by status and by channel", async () => {
    await createIdea(fabio, {
      title: "A",
      channel: "linkedin",
      status: "draft",
    });
    await createIdea(fabio, { title: "B", channel: "linkedin" });
    await createIdea(fabio, { title: "C", channel: "x", status: "draft" });

    const titles = async (filter: Parameters<typeof listIdeas>[1]) =>
      (await listIdeas(fabio.orgId, filter)).map((i) => i.title).sort();

    expect(await titles({ status: "draft" })).toEqual(["A", "C"]);
    expect(await titles({ channel: "linkedin" })).toEqual(["A", "B"]);
    expect(await titles({ status: "draft", channel: "x" })).toEqual(["C"]);
    expect(await titles({})).toEqual(["A", "B", "C"]);
  });

  it("puts the soonest target date first and undated ideas last", async () => {
    await createIdea(fabio, { title: "undated old", channel: "blog" });
    vi.setSystemTime(new Date("2026-11-01T09:01:00.000Z"));
    await createIdea(fabio, {
      title: "later",
      channel: "blog",
      targetDate: "2026-12-01",
    });
    await createIdea(fabio, {
      title: "sooner",
      channel: "blog",
      targetDate: "2026-11-05",
    });
    vi.setSystemTime(new Date("2026-11-01T09:02:00.000Z"));
    await createIdea(fabio, { title: "undated new", channel: "blog" });

    expect((await listIdeas(fabio.orgId)).map((i) => i.title)).toEqual([
      "sooner",
      "later",
      "undated old",
      "undated new",
    ]);
  });
});
