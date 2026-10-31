/**
 * A readable name from the e-mail the Gateway signed in: "fabio.lauria@x.net"
 * is "Fabio Lauria". Display only; the address stays the truth (a tooltip).
 */
export function displayName(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local.split(/[._-]+/).filter(Boolean);
  if (words.length === 0) return email;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// The page renders on the Worker and again in the browser. Their ICU data can
// punctuate a date differently ("Thu, 5 Nov" vs "Thu 5 Nov"), and a text that
// differs between the two is a hydration mismatch. So the words come from Intl
// and the glue is ours.
function words(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  order: readonly Intl.DateTimeFormatPartTypes[],
): string {
  const parts = new Intl.DateTimeFormat("en-GB", options).formatToParts(date);
  return order
    .map((type) => parts.find((part) => part.type === type)?.value)
    .filter(Boolean)
    .join(" ");
}

/** "Thu 5 Nov 2026" for a YYYY-MM-DD day. A day has no time zone, so none is applied. */
export function formatDay(day: string): string {
  return words(
    new Date(`${day}T00:00:00Z`),
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    },
    ["weekday", "day", "month", "year"],
  );
}

/** "31 Oct 2026" for an instant, in `timeZone` (the browser's own when left out). */
export function formatInstant(iso: string, timeZone?: string): string {
  return words(
    new Date(iso),
    { day: "numeric", month: "short", year: "numeric", timeZone },
    ["day", "month", "year"],
  );
}
