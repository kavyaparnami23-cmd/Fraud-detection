export default function SubtypeBreakdownCard({ title, subtitle, items }) {
  const total = items.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>}

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--muted)]">No transactions in this window yet.</p>
      ) : (
        <ul className="mt-4 space-y-0 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--background)]/40">
          {items.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm first:rounded-t-xl last:rounded-b-xl"
            >
              <span className="min-w-0 truncate font-medium text-[var(--foreground)]">{row.label}</span>
              <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                <span className="text-[var(--muted)]">
                  {total > 0 ? `${Math.round((row.value / total) * 100)}%` : "—"}
                </span>
                <span className="min-w-[2.5rem] text-right font-semibold">{row.value}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
