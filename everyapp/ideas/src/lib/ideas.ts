// Pure module: no database, no Worker imports. The server queries, the tools
// and the browser all import it, so the rules for an idea live in one place and
// the form can check them before it calls the server.
import { z } from "zod";

export const CHANNELS = ["linkedin", "x", "newsletter", "blog"] as const;
export type Channel = (typeof CHANNELS)[number];

/** The order of the board's columns, and of an idea's life. */
export const STATUSES = ["idea", "draft", "scheduled", "posted"] as const;
export type Status = (typeof STATUSES)[number];

export const CHANNEL_LABEL: Record<Channel, string> = {
  linkedin: "LinkedIn",
  x: "X",
  newsletter: "Newsletter",
  blog: "Blog",
};

export const STATUS_LABEL: Record<Status, string> = {
  idea: "Idea",
  draft: "Draft",
  scheduled: "Scheduled",
  posted: "Posted",
};

/** True for a real calendar day written YYYY-MM-DD ("2026-02-30" is not one). */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value
  );
}

// The fields, described once. `.describe()` is what an AI client reads.
const title = z
  .string()
  .trim()
  .min(1, "Give the idea a title")
  .max(120, "Keep the title under 120 characters")
  .describe("The idea in a few words, e.g. 'Why our forecasts show a range'.");
const note = z
  .string()
  .trim()
  .max(500, "Keep the note under 500 characters")
  .describe("Optional short note: the angle, a hook, a source.");
const channel = z
  .enum(CHANNELS)
  .describe("Where it will be posted: linkedin, x, newsletter or blog.");
const status = z
  .enum(STATUSES)
  .describe("Where the idea is in its life: idea, draft, scheduled or posted.");
const targetDate = z
  .string()
  .refine(isCalendarDate, "Use a real date")
  .describe("Optional day to post it, as YYYY-MM-DD.");
const id = z
  .string()
  .uuid("Not an idea id")
  .describe("The idea's id, from list_ideas.");

// Every schema is strict: a field nobody listed (an org id, an author) is
// refused instead of ignored, so it can never be smuggled into a row.
export const createIdeaInput = z
  .object({
    title,
    note: note.optional(),
    channel,
    status: status.optional(),
    targetDate: targetDate.nullable().optional(),
  })
  .strict();

export const updateIdeaInput = z
  .object({
    id,
    title: title.optional(),
    note: note.optional(),
    channel: channel.optional(),
    status: status.optional(),
    targetDate: targetDate.nullable().optional(),
  })
  .strict()
  .refine(
    ({ id: _id, ...change }) =>
      Object.values(change).some((value) => value !== undefined),
    "Change at least one field",
  );

export const moveIdeaInput = z.object({ id, status }).strict();
export const deleteIdeaInput = z.object({ id }).strict();

export const listIdeasInput = z
  .object({
    status: status.optional().describe("Only ideas in this status."),
    channel: channel.optional().describe("Only ideas for this channel."),
  })
  .strict();

export type CreateIdeaInput = z.infer<typeof createIdeaInput>;
export type UpdateIdeaInput = z.infer<typeof updateIdeaInput>;
export type MoveIdeaInput = z.infer<typeof moveIdeaInput>;
export type DeleteIdeaInput = z.infer<typeof deleteIdeaInput>;
export type ListIdeasInput = z.infer<typeof listIdeasInput>;

/** An idea as the board and the tools see it. No organization id, ever. */
export interface Idea {
  id: string;
  title: string;
  note: string;
  channel: Channel;
  status: Status;
  /** YYYY-MM-DD, or null. */
  targetDate: string | null;
  /** Who added it: the e-mail the Gateway signed in. */
  addedBy: string;
  /** When, as an ISO 8601 instant (UTC). */
  addedAt: string;
  /** Who last changed it (the author, until someone else does). */
  changedBy: string;
  changedAt: string;
}

/** Parses or throws one readable sentence (the first problem), not a JSON dump. */
export function parseInput<S extends z.ZodType>(
  schema: S,
  data: unknown,
): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "That isn't valid.");
  }
  return result.data;
}
