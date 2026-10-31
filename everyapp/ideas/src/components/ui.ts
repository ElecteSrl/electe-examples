// Class strings shared by the components: the ELECTE look in one place.
// Navy is the primary action, a quiet outline is the secondary one, and teal
// appears only as the focus ring (src/styles/app.css).

const button =
  "inline-flex items-center justify-center gap-1 rounded-lg px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/** The one action on a screen: navy with white text. 44px tall. */
export const primaryButton = `${button} min-h-11 bg-navy text-white hover:bg-navy/90`;

/** Everything else: outlined, on the card. 44px tall in a form, 36px on a card. */
export const secondaryButton = `${button} min-h-11 border border-navy/30 bg-paper text-navy hover:border-navy hover:bg-white`;
export const smallButton = `${button} min-h-9 border border-navy/25 bg-paper text-navy hover:border-navy hover:bg-white`;

export const dangerButton = `${button} min-h-11 border border-danger bg-paper text-danger hover:bg-white`;

export const field =
  "w-full rounded-lg border border-navy/30 bg-white px-3 py-2 text-base text-navy placeholder:text-ink-soft focus-visible:border-navy";
export const label = "mb-1 block text-sm font-medium text-navy";
