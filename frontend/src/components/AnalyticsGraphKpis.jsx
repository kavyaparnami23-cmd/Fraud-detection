function GraphKpiShell({ title, value, hint, children }) {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">{title}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>}
        </div>
      </div>
      <div className="mt-3 min-h-[52px] flex-1">{children}</div>
    </div>
  );
}

function Sparkline({ values, stroke = "#22d3ee" }) {
  const w = 280;
  const h = 44;
  if (!values?.length) {
    return <p className="text-xs text-[var(--muted)]">No series yet</p>;
  }
  const min = Math.min(...values, 0);
  const max = Math.max(...values, min + 0.0001);
  const pad = 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / (max - min)) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(" ")}
      />
      {values.map((v, i) => {
        const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
        const y = pad + (1 - (v - min) / (max - min)) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r="2.2" fill={stroke} opacity="0.9" />;
      })}
    </svg>
  );
}

function ActivityMicroBars({ buckets }) {
  const w = 280;
  const h = 44;
  if (!buckets?.length) {
    return <p className="text-xs text-[var(--muted)]">No buckets yet</p>;
  }
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const gap = 2;
  const barW = (w - gap * (buckets.length + 1)) / buckets.length;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" preserveAspectRatio="none">
      {buckets.map((b, i) => {
        const bh = (b.count / max) * (h - 6);
        const x = gap + i * (barW + gap);
        const y = h - 2 - bh;
        const fraudH = b.count ? (b.fraud / b.count) * bh : 0;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx="1.5" fill="rgba(34, 211, 238, 0.35)" />
            {fraudH > 0.5 && (
              <rect x={x} y={y + bh - fraudH} width={barW} height={fraudH} rx="1" fill="rgba(248, 113, 113, 0.85)" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function RiskStackBar({ items }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const colors = { Low: "#34d399", Medium: "#fbbf24", High: "#f87171" };
  return (
    <div className="flex h-9 w-full overflow-hidden rounded-lg bg-[var(--background)]">
      {items.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-center text-[10px] font-semibold text-black/80"
          style={{
            width: `${(row.value / total) * 100}%`,
            backgroundColor: colors[row.label] || "#71717a",
            minWidth: row.value > 0 ? "8px" : "0px",
          }}
          title={`${row.label}: ${row.value}`}
        >
          {row.value > 0 && (row.value / total) * 100 > 12 ? row.label : ""}
        </div>
      ))}
    </div>
  );
}

function SourceSplitBar({ manual, simulation }) {
  const total = manual + simulation;
  if (total === 0) {
    return <p className="text-xs text-[var(--muted)]">No source data</p>;
  }
  const mPct = (manual / total) * 100;
  const sPct = (simulation / total) * 100;
  return (
    <div className="space-y-2">
      <div className="flex h-9 w-full overflow-hidden rounded-lg bg-[var(--background)]">
        <div
          className="flex items-center justify-center bg-violet-500/80 text-[10px] font-semibold text-white"
          style={{ width: `${mPct}%`, minWidth: manual > 0 ? "6px" : 0 }}
        >
          {mPct > 18 ? `${Math.round(mPct)}%` : ""}
        </div>
        <div
          className="flex items-center justify-center bg-cyan-600/75 text-[10px] font-semibold text-white"
          style={{ width: `${sPct}%`, minWidth: simulation > 0 ? "6px" : 0 }}
        >
          {sPct > 18 ? `${Math.round(sPct)}%` : ""}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-[var(--muted)]">
        <span>Manual {manual}</span>
        <span>Sim {simulation}</span>
      </div>
    </div>
  );
}

export default function AnalyticsGraphKpis({ stats }) {
  const series = stats?.charts?.kpi_series;
  const risk = stats?.charts?.risk_distribution;
  if (!stats) return null;

  const t = stats.totals;
  const fraudScores = series?.fraud_scores || [];
  const buckets = series?.activity_buckets || [];
  const manual = t.manual_transactions ?? 0;
  const simulation = t.simulation_transactions ?? 0;

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <GraphKpiShell
        title="Fraud score (recent)"
        value={`${(t.average_fraud_score * 100).toFixed(1)}%`}
        hint={`Last ${fraudScores.length} scores in the analytics window (oldest → newest), not only the live stream`}
      >
        <Sparkline values={fraudScores} />
      </GraphKpiShell>

      <GraphKpiShell
        title="Activity by segment"
        value={t.total_transactions}
        hint="Bar height = tx count; red tip = fraud in segment"
      >
        <ActivityMicroBars buckets={buckets} />
      </GraphKpiShell>

      <GraphKpiShell
        title="Risk mix"
        value={`${t.high_risk_transactions} high`}
        hint="Share of low / medium / high in sample"
      >
        {risk?.length ? <RiskStackBar items={risk} /> : <p className="text-xs text-[var(--muted)]">—</p>}
      </GraphKpiShell>

      <GraphKpiShell
        title="Traffic sources"
        value={`${manual} manual`}
        hint={`${simulation} simulation · stacked share`}
      >
        <SourceSplitBar manual={manual} simulation={simulation} />
      </GraphKpiShell>
    </section>
  );
}
