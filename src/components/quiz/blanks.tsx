import type { JSX } from "react";
import { t } from "~/lang";

/** Replaces runs of 2+ underscores with a styled inline blank element. */
export function renderWithBlanks(text: string): (string | JSX.Element)[] {
  return text.split(/(_{2,})/).map((part, i) =>
    /^_{2,}$/.test(part) ? (
      <span
        key={i}
        className="inline-block min-w-[4.5ch] mx-0.5 px-2 py-0.5 align-baseline rounded-[3px] bg-primary/[.07] border-b-2 border-primary/40"
        aria-label={t.blankAriaLabel}
      />
    ) : part
  );
}
