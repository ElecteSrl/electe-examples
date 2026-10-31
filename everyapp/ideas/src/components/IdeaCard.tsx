import { displayName, formatDay } from "@/lib/format";
import {
  CHANNEL_LABEL,
  STATUSES,
  STATUS_LABEL,
  type Idea,
  type Status,
} from "@/lib/ideas";
import { smallButton } from "./ui";
import { When } from "./When";

interface Props {
  idea: Idea;
  /** A change to this idea is on its way: its buttons wait. */
  busy: boolean;
  onMove: (to: Status) => void;
  onEdit: () => void;
}

/**
 * One idea. Moving it is two plain buttons (back, forward) that name the
 * column they go to, so the board works with a keyboard or a screen reader and
 * needs no drag and drop. The card itself can take focus (tabIndex -1) so the
 * board can put focus back on it after it has moved to another column.
 */
export function IdeaCard({ idea, busy, onMove, onEdit }: Props) {
  const at = STATUSES.indexOf(idea.status);
  const back = STATUSES[at - 1];
  const forward = STATUSES[at + 1];
  const changedSince = idea.changedAt !== idea.addedAt;

  return (
    <li
      id={`card-${idea.id}`}
      tabIndex={-1}
      aria-busy={busy}
      className="rounded-xl border border-line bg-paper p-3 shadow-sm"
    >
      <h3 className="break-words text-base font-semibold leading-snug">
        {idea.title}
      </h3>
      {idea.note && (
        <p className="mt-1 line-clamp-4 whitespace-pre-line break-words text-sm text-ink-soft">
          {idea.note}
        </p>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-full border border-navy/25 px-2 py-0.5 font-medium">
          {CHANNEL_LABEL[idea.channel]}
        </span>
        {idea.targetDate && (
          <span className="rounded-full border border-navy/25 px-2 py-0.5">
            <span className="sr-only">Target date </span>
            <time dateTime={idea.targetDate}>{formatDay(idea.targetDate)}</time>
          </span>
        )}
      </p>

      <div className="mt-2 text-xs text-ink-soft">
        <p>
          Added by <Person email={idea.addedBy} /> · <When iso={idea.addedAt} />
        </p>
        {changedSince && (
          <p>
            Changed by <Person email={idea.changedBy} /> ·{" "}
            <When iso={idea.changedAt} />
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {back && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onMove(back)}
            aria-label={`Move “${idea.title}” back to ${STATUS_LABEL[back]}`}
            className={smallButton}
          >
            <span aria-hidden="true">←</span> {STATUS_LABEL[back]}
          </button>
        )}
        {forward && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onMove(forward)}
            aria-label={`Move “${idea.title}” to ${STATUS_LABEL[forward]}`}
            className={smallButton}
          >
            {STATUS_LABEL[forward]} <span aria-hidden="true">→</span>
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onEdit}
          aria-label={`Edit “${idea.title}”`}
          className={`${smallButton} ml-auto`}
        >
          Edit
        </button>
      </div>
    </li>
  );
}

/** A person by name, with the address they signed in with as the tooltip. */
function Person({ email }: { email: string }) {
  return (
    <span title={email} className="font-medium text-navy">
      {displayName(email)}
    </span>
  );
}
