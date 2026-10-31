import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { ideas } from "@/db/schema";
import type {
  CreateIdeaInput,
  DeleteIdeaInput,
  Idea,
  ListIdeasInput,
  MoveIdeaInput,
  UpdateIdeaInput,
} from "@/lib/ideas";

/**
 * Who is acting: the verified caller, as the Gateway signed it. An
 * EveryAppUser fits; the server function and the tool handler pass `user`.
 * `orgId` scopes every query, `id` and `email` stamp the row.
 */
interface Actor {
  id: string;
  email: string;
  orgId: string;
}

// What leaves the server: never the organization id.
const shown = {
  id: ideas.id,
  title: ideas.title,
  note: ideas.note,
  channel: ideas.channel,
  status: ideas.status,
  targetDate: ideas.targetDate,
  addedBy: ideas.addedByEmail,
  addedAt: ideas.addedAt,
  changedBy: ideas.changedByEmail,
  changedAt: ideas.changedAt,
};

// The board is shared: the Gateway admits every member of the organization, and
// every member sees and edits the organization's ideas. So every query below is
// scoped by the organization in the signed identity, and by nothing a client
// sent. An id from another organization simply matches no row.
const inOrg = (orgId: string) => eq(ideas.orgId, orgId);

/** The organization's ideas: soonest target date first, undated last, then oldest first. */
export function listIdeas(
  orgId: string,
  filter: ListIdeasInput = {},
): Promise<Idea[]> {
  return db
    .select(shown)
    .from(ideas)
    .where(
      and(
        inOrg(orgId),
        filter.status ? eq(ideas.status, filter.status) : undefined,
        filter.channel ? eq(ideas.channel, filter.channel) : undefined,
      ),
    )
    .orderBy(
      sql`${ideas.targetDate} is null`,
      asc(ideas.targetDate),
      asc(ideas.addedAt),
      asc(ideas.id),
    );
}

export async function createIdea(
  actor: Actor,
  input: CreateIdeaInput,
): Promise<Idea> {
  const now = new Date().toISOString();
  const [idea] = await db
    .insert(ideas)
    .values({
      id: crypto.randomUUID(),
      orgId: actor.orgId,
      title: input.title,
      note: input.note ?? "",
      channel: input.channel,
      status: input.status ?? "idea",
      targetDate: input.targetDate ?? null,
      addedById: actor.id,
      addedByEmail: actor.email,
      addedAt: now,
      changedById: actor.id,
      changedByEmail: actor.email,
      changedAt: now,
    })
    .returning(shown);
  return idea!;
}

/** The changed idea, or null when the organization has none with that id. */
export async function updateIdea(
  actor: Actor,
  { id, ...change }: UpdateIdeaInput,
): Promise<Idea | null> {
  const [idea] = await db
    .update(ideas)
    .set({
      // Only what was given changes; `targetDate: null` clears the date.
      ...(change.title !== undefined && { title: change.title }),
      ...(change.note !== undefined && { note: change.note }),
      ...(change.channel !== undefined && { channel: change.channel }),
      ...(change.status !== undefined && { status: change.status }),
      ...(change.targetDate !== undefined && { targetDate: change.targetDate }),
      changedById: actor.id,
      changedByEmail: actor.email,
      changedAt: new Date().toISOString(),
    })
    .where(and(eq(ideas.id, id), inOrg(actor.orgId)))
    .returning(shown);
  return idea ?? null;
}

/**
 * Moves an idea to a status. Already there: nothing changes, and nobody is
 * recorded as having changed it. Null when the organization has no such idea.
 */
export async function moveIdea(
  actor: Actor,
  { id, status }: MoveIdeaInput,
): Promise<Idea | null> {
  const [current] = await db
    .select(shown)
    .from(ideas)
    .where(and(eq(ideas.id, id), inOrg(actor.orgId)))
    .limit(1);
  if (!current) return null;
  if (current.status === status) return current;
  return updateIdea(actor, { id, status });
}

/** The deleted idea, or null when the organization has none with that id. */
export async function deleteIdea(
  orgId: string,
  { id }: DeleteIdeaInput,
): Promise<Idea | null> {
  const [idea] = await db
    .delete(ideas)
    .where(and(eq(ideas.id, id), inOrg(orgId)))
    .returning(shown);
  return idea ?? null;
}
