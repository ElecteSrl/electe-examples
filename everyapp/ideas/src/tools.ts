// The app's tools for AI clients (Claude, Cursor, ...). The Gateway serves them
// at /mcp as ideas_list_ideas, ideas_add_idea and ideas_move_idea, and calls
// each with the signed-in person: the app never speaks MCP itself, never checks
// a token, and takes no user or organization from a tool's arguments.
//
// `risk` is honest. There is deliberately no delete tool: a destructive tool
// stays hidden from AI clients until the Gateway has approvals, and removing an
// idea is something a person does on the board.
import { ToolError, defineTools } from "@every-app/sdk/server";
import { createIdeaInput, listIdeasInput, moveIdeaInput } from "@/lib/ideas";
import * as ideas from "@/server/ideas";

export const tools = defineTools(
  {
    list_ideas: {
      description:
        "List the team's social-post ideas on the shared board, optionally only one status or one channel. Soonest target date first.",
      risk: "read",
      input: listIdeasInput,
      handler: (input, { user }) => ideas.listIdeas(user.orgId, input),
    },
    add_idea: {
      description:
        "Add an idea to the shared board. It is recorded as added by the person this connection acts for. It starts in status 'idea' unless you give another.",
      risk: "write",
      idempotent: false,
      input: createIdeaInput,
      handler: (input, { user }) => ideas.createIdea(user, input),
    },
    move_idea: {
      description:
        "Move an idea to another status (idea, draft, scheduled, posted). Only the status changes.",
      risk: "write",
      idempotent: true,
      input: moveIdeaInput,
      handler: async (input, { user }) =>
        (await ideas.moveIdea(user, input)) ?? raise("No idea with that id"),
    },
  },
  {
    instructions:
      "This is the team's shared board of social-post ideas. Never guess an idea id: call list_ideas first when an id isn't already known. Channels are linkedin, x, newsletter and blog; statuses run idea, draft, scheduled, posted.",
  },
);

/** A message the model may read; any other error reaches it as "Internal error". */
function raise(message: string): never {
  throw new ToolError(message);
}
