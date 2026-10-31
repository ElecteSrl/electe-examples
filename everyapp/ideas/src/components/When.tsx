import { useEffect, useState } from "react";
import { formatInstant } from "@/lib/format";

/**
 * A date for an instant, in the viewer's own time zone. The page is rendered
 * first on the Worker (UTC), so the first paint says the UTC day and the
 * browser corrects it right after mounting; the text never differs between the
 * server's render and the browser's first render, so hydration stays clean.
 */
export function When({ iso }: { iso: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <time dateTime={iso}>
      {formatInstant(iso, mounted ? undefined : "UTC")}
    </time>
  );
}
