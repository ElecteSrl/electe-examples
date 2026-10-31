import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CHANNELS,
  CHANNEL_LABEL,
  STATUSES,
  STATUS_LABEL,
  createIdeaInput,
  parseInput,
  type CreateIdeaInput,
  type Idea,
} from "@/lib/ideas";
import {
  dangerButton,
  field,
  label,
  primaryButton,
  secondaryButton,
} from "./ui";

interface Props {
  /** The idea being edited, or null for a new one. */
  idea: Idea | null;
  onClose: () => void;
  /** Saves; a thrown error is shown in the dialog and the dialog stays open. */
  onSave: (values: CreateIdeaInput) => Promise<void>;
  /** Present when editing: deletes the idea for everyone. */
  onDelete?: () => Promise<void>;
}

/**
 * Add or edit an idea in a native <dialog>: the browser traps focus inside it,
 * Escape closes it, and focus returns to where it was. Who adds or changes the
 * idea is not a field: the server takes it from the signed-in identity.
 */
export function IdeaDialog({ idea, onClose, onSave, onDelete }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  async function run(work: () => Promise<void>) {
    setError(null);
    setPending(true);
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't work.");
      setPending(false);
    }
    // On success the board closes this dialog, so there is nothing to reset.
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const status = data.get("status");
    // The same rules the server applies, so a mistake is caught here in a sentence.
    let values: CreateIdeaInput;
    try {
      values = parseInput(createIdeaInput, {
        title: data.get("title"),
        note: data.get("note"),
        channel: data.get("channel"),
        ...(status ? { status } : {}),
        targetDate: data.get("targetDate") || null,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That isn't valid.");
      return;
    }
    void run(() => onSave(values));
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="idea-dialog-title"
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself, not on the form.
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-line bg-paper p-0 text-navy shadow-2xl backdrop:bg-navy/50"
    >
      <form onSubmit={submit} className="flex flex-col gap-4 p-5">
        <h2 id="idea-dialog-title" className="text-lg font-semibold">
          {idea ? "Edit idea" : "Add an idea"}
        </h2>

        <div>
          <label htmlFor="idea-title" className={label}>
            Title
          </label>
          <input
            id="idea-title"
            name="title"
            required
            maxLength={120}
            autoComplete="off"
            defaultValue={idea?.title ?? ""}
            placeholder="The idea in a few words"
            className={field}
          />
        </div>

        <div>
          <label htmlFor="idea-note" className={label}>
            Note <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <textarea
            id="idea-note"
            name="note"
            rows={3}
            maxLength={500}
            defaultValue={idea?.note ?? ""}
            placeholder="The angle, a hook, a source"
            className={field}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="idea-channel" className={label}>
              Channel
            </label>
            <select
              id="idea-channel"
              name="channel"
              defaultValue={idea?.channel ?? "linkedin"}
              className={field}
            >
              {CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {CHANNEL_LABEL[channel]}
                </option>
              ))}
            </select>
          </div>

          {idea && (
            <div>
              <label htmlFor="idea-status" className={label}>
                Status
              </label>
              <select
                id="idea-status"
                name="status"
                defaultValue={idea.status}
                className={field}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="idea-date" className={label}>
              Target date{" "}
              <span className="font-normal text-ink-soft">(optional)</span>
            </label>
            <input
              id="idea-date"
              name="targetDate"
              type="date"
              defaultValue={idea?.targetDate ?? ""}
              className={field}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}

        {confirmingDelete && onDelete ? (
          <div
            role="group"
            aria-label="Confirm deleting this idea"
            className="flex flex-col gap-3 rounded-lg border border-danger/40 p-3"
          >
            <p className="text-sm">
              Delete this idea for everyone on the board? It can't be brought
              back.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => void run(onDelete)}
                className={dangerButton}
              >
                {pending ? "Deleting…" : "Yes, delete it"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmingDelete(false)}
                className={secondaryButton}
              >
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={pending} className={primaryButton}>
              {pending ? "Saving…" : idea ? "Save changes" : "Add idea"}
            </button>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className={secondaryButton}
            >
              Cancel
            </button>
            {idea && onDelete && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className={`${dangerButton} ml-auto`}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </form>
    </dialog>
  );
}
