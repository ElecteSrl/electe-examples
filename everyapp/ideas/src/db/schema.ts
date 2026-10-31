import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
// Relative, not "@/lib/ideas": drizzle-kit loads this file on its own, without
// the app's path aliases.
import { CHANNELS, STATUSES } from "../lib/ideas";

export const ideas = sqliteTable(
  "ideas",
  {
    id: text("id").primaryKey(),
    // The Gateway's organization id (`user.orgId`). The board is shared by
    // everyone in the organization, so this, not the user, is the tenancy key:
    // every query filters by it. It comes from the signed identity only.
    orgId: text("org_id").notNull(),
    title: text("title").notNull(),
    note: text("note").notNull().default(""),
    channel: text("channel", { enum: CHANNELS }).notNull(),
    status: text("status", { enum: STATUSES }).notNull().default("idea"),
    // A calendar day, YYYY-MM-DD, or null.
    targetDate: text("target_date"),
    // Who added it and when. The id is the Gateway's user id; the e-mail is
    // copied from the signed identity for display. Never typed by a person.
    addedById: text("added_by_id").notNull(),
    addedByEmail: text("added_by_email").notNull(),
    // ISO 8601 instants, UTC, written by the server.
    addedAt: text("added_at").notNull(),
    // Who last changed it and when (the author, until someone else does).
    changedById: text("changed_by_id").notNull(),
    changedByEmail: text("changed_by_email").notNull(),
    changedAt: text("changed_at").notNull(),
  },
  (table) => [index("ideas_org_status_idx").on(table.orgId, table.status)],
);
