import { Fragment } from 'react';

/** Wraps every case-insensitive occurrence of `query` in `text` with a `<mark>` — used by the table's order-number/pickup-code cells so a search match is visually obvious, not just implied by the row being present. */
export function HighlightMatch({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;

  const index = text.toLowerCase().indexOf(trimmed.toLowerCase());
  if (index === -1) return <>{text}</>;

  const before = text.slice(0, index);
  const match = text.slice(index, index + trimmed.length);
  const after = text.slice(index + trimmed.length);

  return (
    <Fragment>
      {before}
      <mark className="rounded-sm bg-primary/20 text-inherit">{match}</mark>
      {after}
    </Fragment>
  );
}
