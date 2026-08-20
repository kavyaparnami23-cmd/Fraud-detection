import { useMemo } from "react";
import AnalyticsGraphKpis from "../components/AnalyticsGraphKpis";
import DashboardCharts from "../components/DashboardCharts";
import { useDashboardPolling } from "../hooks/useDashboardPolling";

function KpiCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { stats, history, loading, error, fetchDashboardData } = useDashboardPolling(5000);

  const summaryCards = useMemo(() => {
    if (!stats) return [];
    const t = stats.totals;
    return [
      { label: "Total transactions", value: t.total_transactions },
      { label: "Flagged fraud", value: t.fraudulent_transactions },
      {
        label: "Fraud rate",
        value: `${(t.fraud_rate * 100).toFixed(1)}%`,
        hint: "Share predicted as fraud",
      },
      { label: "High risk", value: t.high_risk_transactions },
      { label: "Alerts", value: t.alerts_triggered },
      {
        label: "Avg fraud score",
        value: `${(t.average_fraud_score * 100).toFixed(1)}%`,
        hint: "Mean hybrid score",
      },
      {
        label: "Medium risk",
        value: t.medium_risk_transactions ?? 0,
        hint: "Between low and high buckets",
      },
      {
        label: "Avg ticket size",
        value: `$${Number(t.average_transaction_amount ?? 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        hint: "Mean transaction amount",
      },
    ];
  }, [stats]);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Analytics</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            KPIs and charts aggregate a wide recent window (not only an active simulation). Recent activity lists your
            latest rows across manual and simulated traffic.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchDashboardData}
          className="self-start rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--surface-hover)]"
        >
          Refresh now
        </button>
      </div>

      {!error && stats?.meta && stats.meta.total_in_database > stats.meta.analytics_sample_size && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
          <p className="font-medium text-amber-50">Wider history exists in the database</p>
          <p className="mt-1 text-amber-100/85">
            Charts and KPIs are built from your <strong>{stats.meta.analytics_sample_size}</strong> newest
            transactions (this request allows up to <strong>{stats.meta.analytics_limit_requested}</strong>). Your
            account has <strong>{stats.meta.total_in_database}</strong> rows in total, so anything older than that tail
            window is excluded — a long simulation can push older manual runs out of the aggregate until you raise the
            limit on <code className="rounded bg-black/20 px-1">GET /api/transaction/stats?limit=</code> (max 10,000).
          </p>
        </div>
      )}

      {error && (
        <div
          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          <p className="font-semibold">Unable to load data</p>
          <p className="mt-1 text-red-200/90">{error}</p>
          <p className="mt-2 text-xs text-red-200/70">
            Start the API on port 5000, run <code className="rounded bg-black/30 px-1">npm run dev</code> for the
            frontend (uses a dev proxy), and sign in again so requests include your token.
          </p>
        </div>
      )}

      {!loading && stats && stats.totals?.total_transactions === 0 && !error && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--muted)]">
          <p className="font-medium text-[var(--foreground)]">No transactions for this account yet</p>
          <p className="mt-1">
            Open <strong>Simulation</strong> to submit a manual score or start a generated stream. Rows in MongoDB
            must have a <code className="rounded bg-[var(--background)] px-1">userId</code> matching your logged-in
            user, or they will not appear here.
          </p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <KpiCard key={card.label} label={card.label} value={card.value} hint={card.hint} />
        ))}
      </section>

      {stats && <AnalyticsGraphKpis stats={stats} />}

      {stats?.charts && <DashboardCharts charts={stats.charts} />}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Recent activity</h2>
            <p className="text-sm text-[var(--muted)]">
              Up to 100 latest rows (manual + simulation), newest first — not limited to the current stream.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--background)]/80 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Reasons</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {!history.length && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                      No rows yet. After your first scored transaction, activity will show here.
                    </td>
                  </tr>
                )}
                {history.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-[var(--surface-hover)]/50">
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--muted)]">
                      {new Date(item.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 capitalize">{item.source}</td>
                    <td className="px-4 py-3 tabular-nums">${Number(item.amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">{item.location}</td>
                    <td className="px-4 py-3">{item.payment_method}</td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          item.risk_level === "High"
                            ? "bg-red-500/15 text-red-300"
                            : item.risk_level === "Medium"
                              ? "bg-amber-500/15 text-amber-200"
                              : "bg-emerald-500/15 text-emerald-200",
                        ].join(" ")}
                      >
                        {item.risk_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium">
                      {((item.final_score ?? item.fraud_probability ?? 0) * 100).toFixed(1)}%
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-[var(--muted)]">
                      {item.reason_codes?.length ? item.reason_codes.join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
