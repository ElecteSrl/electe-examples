import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { IdeaCard } from "@/components/IdeaCard";
import { IdeaDialog } from "@/components/IdeaDialog";
import { primaryButton } from "@/components/ui";
import { displayName } from "@/lib/format";
import {
  CHANNELS,
  CHANNEL_LABEL,
  STATUSES,
  STATUS_LABEL,
  type Channel,
  type CreateIdeaInput,
  type Idea,
  type Status,
} from "@/lib/ideas";
import {
  addIdea,
  editIdea,
  getBoard,
  moveIdea,
  removeIdea,
} from "@/serverFunctions/ideas";

export const Route = createFileRoute("/")({
  loader: () => getBoard(),
  head: () => ({ meta: [{ title: "Ideas · ELECTE" }] }),
  component: Board,
});

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : "That didn't work.";
}

function Board() {
  const { me, ideas, launcher } = Route.useLoaderData();
  const router = useRouter();

  // null = every channel.
  const [channel, setChannel] = useState<Channel | null>(null);
  // The open dialog: a new idea (idea: null) or an existing one.
  const [editing, setEditing] = useState<{ idea: Idea | null } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Read out by screen readers after a change (aria-live), invisible on screen.
  const [notice, setNotice] = useState("");
  // The card to give focus back to, and the column it is moving to.
  const [focusTarget, setFocusTarget] = useState<{
    id: string;
    status: Status;
  } | null>(null);

  // Colleagues change the same board. Look again when this tab comes back.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void router.invalidate();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  // A moved card is a new element in another column: keyboard focus would be
  // lost with the old one, so put it back on the card. Only once the board
  // shows the card in its new column; before that the old card is still there
  // and would take the focus just before it goes away.
  useEffect(() => {
    if (!focusTarget) return;
    const idea = ideas.find((candidate) => candidate.id === focusTarget.id);
    if (!idea) return setFocusTarget(null); // deleted by someone meanwhile
    if (idea.status !== focusTarget.status) return; // runs again with new data
    const frame = requestAnimationFrame(() => {
      document.getElementById(`card-${idea.id}`)?.focus();
      setFocusTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusTarget, ideas]);

  const refresh = () => router.invalidate().catch(() => undefined);

  async function move(idea: Idea, to: Status) {
    setBusyId(idea.id);
    setError(null);
    setFocusTarget(null);
    try {
      await moveIdea({ data: { id: idea.id, status: to } });
      await router.invalidate();
      setNotice(`Moved “${idea.title}” to ${STATUS_LABEL[to]}.`);
      setFocusTarget({ id: idea.id, status: to });
    } catch (cause) {
      setError(messageOf(cause));
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function save(values: CreateIdeaInput) {
    const editedIdea = editing?.idea;
    try {
      if (editedIdea) {
        await editIdea({ data: { id: editedIdea.id, ...values } });
        setNotice(`Saved “${values.title}”.`);
      } else {
        await addIdea({ data: values });
        setNotice(`Added “${values.title}”.`);
      }
    } catch (cause) {
      await refresh();
      throw cause;
    }
    setEditing(null);
    await refresh();
  }

  async function remove(idea: Idea) {
    try {
      await removeIdea({ data: { id: idea.id } });
    } catch (cause) {
      await refresh();
      throw cause;
    }
    setNotice(`Deleted “${idea.title}”.`);
    setEditing(null);
    await refresh();
  }

  const counts = (c: Channel) =>
    ideas.filter((idea) => idea.channel === c).length;
  const visible = channel
    ? ideas.filter((idea) => idea.channel === channel)
    : ideas;
  const inColumn = (status: Status) =>
    visible.filter((idea) => idea.status === status);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-4">
        <a
          href={launcher}
          aria-label="Back to EveryApp"
          className="w-fit text-sm text-ink-soft hover:text-navy hover:underline"
        >
          ‹ EveryApp
        </a>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Ideas</h1>
            <p className="mt-1 text-ink-soft">
              Post ideas for LinkedIn, X, the newsletter and the blog. One board
              for the whole team.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing({ idea: null })}
            className={primaryButton}
          >
            Add idea
          </button>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-paper px-3 py-2 text-sm font-medium text-danger"
        >
          {error}
        </p>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {notice}
      </p>

      {ideas.length === 0 ? (
        <section
          aria-labelledby="empty-title"
          className="rounded-2xl border border-dashed border-navy/25 bg-paper px-6 py-14 text-center"
        >
          <h2 id="empty-title" className="text-lg font-semibold">
            No ideas yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-ink-soft">
            This board is shared: whatever you add here,{" "}
            {me.org ? `everyone in ${me.org}` : "everyone on the team"} sees.
            Start with a hook, a number or a story worth telling.
          </p>
          <button
            type="button"
            onClick={() => setEditing({ idea: null })}
            className={`${primaryButton} mt-6`}
          >
            Add the first idea
          </button>
        </section>
      ) : (
        <>
          <div
            role="group"
            aria-label="Filter by channel"
            className="flex flex-wrap gap-2"
          >
            <FilterChip
              pressed={channel === null}
              onClick={() => setChannel(null)}
            >
              All <Count n={ideas.length} />
            </FilterChip>
            {CHANNELS.map((c) => (
              <FilterChip
                key={c}
                pressed={channel === c}
                onClick={() => setChannel(c)}
              >
                {CHANNEL_LABEL[c]} <Count n={counts(c)} />
              </FilterChip>
            ))}
          </div>

          {channel && visible.length === 0 && (
            <p className="text-sm text-ink-soft">
              No {CHANNEL_LABEL[channel]} ideas yet. Add one, or choose All.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {STATUSES.map((status) => {
              const cards = inColumn(status);
              return (
                <section
                  key={status}
                  aria-labelledby={`column-${status}`}
                  className="min-w-0 rounded-xl bg-well p-3"
                >
                  <h2
                    id={`column-${status}`}
                    className="flex items-center justify-between px-1 text-sm font-semibold uppercase tracking-wide"
                  >
                    {STATUS_LABEL[status]}
                    <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-medium normal-case tracking-normal text-ink-soft">
                      <span className="sr-only">
                        {cards.length === 1
                          ? "1 idea"
                          : `${cards.length} ideas`}
                      </span>
                      <span aria-hidden="true">{cards.length}</span>
                    </span>
                  </h2>
                  {cards.length === 0 ? (
                    <p className="mt-3 px-1 text-sm text-ink-soft">
                      Nothing here yet.
                    </p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-3">
                      {cards.map((idea) => (
                        <IdeaCard
                          key={idea.id}
                          idea={idea}
                          busy={busyId === idea.id}
                          onMove={(to) => void move(idea, to)}
                          onEdit={() => setEditing({ idea })}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      <footer className="border-t border-line pt-4 text-sm text-ink-soft">
        <p>
          Signed in as{" "}
          <strong className="font-semibold text-navy" title={me.email}>
            {displayName(me.email)}
          </strong>{" "}
          ({me.email}), {me.role}
          {me.org ? ` of ${me.org}` : ""}. The Gateway signed you in; this app
          has no login of its own.
        </p>
        <details className="mt-3">
          <summary className="w-fit cursor-pointer font-medium text-navy">
            How this example works
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Who you are comes from the Gateway, signed. “Added by” and
              “Changed by” are filled in on the server from it, never typed.
            </li>
            <li>
              The board belongs to the organization: every query is filtered by
              the organization in that identity, so everyone signed in sees and
              edits the same ideas, and nobody outside does.
            </li>
            <li>
              The ideas live in this app's own database (table{" "}
              <code>ideas</code>) in ELECTE's Cloudflare account.
            </li>
            <li>
              Claude can use the board too: the Gateway serves{" "}
              <code>ideas_list_ideas</code>, <code>ideas_add_idea</code> and{" "}
              <code>ideas_move_idea</code> at its <code>/mcp</code>.
            </li>
          </ul>
        </details>
      </footer>

      {editing && (
        <IdeaDialog
          idea={editing.idea}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={
            editing.idea ? () => remove(editing.idea as Idea) : undefined
          }
        />
      )}
    </main>
  );
}

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors ${
        pressed
          ? "border-navy bg-navy text-white"
          : "border-navy/25 bg-paper text-navy hover:border-navy"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="text-xs font-normal opacity-80">
      <span className="sr-only">, </span>
      {n}
    </span>
  );
}
