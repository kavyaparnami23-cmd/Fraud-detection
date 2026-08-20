import SubtypeBreakdownCard from "./SubtypeBreakdownCard";

function chartShell(title, subtitle, children) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>}
      {children}
    </div>
  );
}

function DonutChart({ items }) {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  let current = 0;
  const colors = ["#34d399", "#fbbf24", "#f87171"];

  const segments = items.map((item, index) => {
    const percentage = item.value / total;
    const start = current;
    current += percentage;
    return {
      ...item,
      color: colors[index % colors.length],
      start,
      end: current,
    };
  });

  return (
    <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
      <svg viewBox="0 0 42 42" className="h-48 w-48 shrink-0 -rotate-90">
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#27272a" strokeWidth="6" />
        {segments.map((segment) => (
          <circle
            key={segment.label}
            cx="21"
            cy="21"
            r="15.915"
            fill="transparent"
            stroke={segment.color}
            strokeWidth="6"
            strokeDasharray={`${(segment.end - segment.start) * 100} ${100 - (segment.end - segment.start) * 100}`}
            strokeDashoffset={-segment.start * 100}
          />
        ))}
      </svg>

      <div className="flex w-full max-w-xs flex-col gap-3">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-[var(--muted)]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
              {segment.label}
            </span>
            <span className="font-semibold tabular-nums">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardCharts({ charts }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-xl">
        {chartShell("Risk distribution", "Low / medium / high in the current sample", <DonutChart items={charts.risk_distribution} />)}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SubtypeBreakdownCard
          title="Payment methods"
          subtitle="Count per instrument in the sample window"
          items={charts.by_payment_method || []}
        />
        <SubtypeBreakdownCard
          title="Locations"
          subtitle="Count per city / region"
          items={charts.by_location || []}
        />
        <SubtypeBreakdownCard
          title="Transaction types"
          subtitle="Count per category"
          items={charts.by_transaction_type || []}
        />
      </div>
    </div>
  );
}
