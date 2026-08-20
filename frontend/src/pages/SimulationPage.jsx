import { useState } from "react";
import api from "../api";
import TransactionForm from "../components/TransactionForm";
import { useDashboardPolling } from "../hooks/useDashboardPolling";

export default function SimulationPage() {
  const { stats, fetchDashboardData, error } = useDashboardPolling(5000);
  const [simulating, setSimulating] = useState(false);
  const [form, setForm] = useState({
    count: 250,
    durationSeconds: 120,
  });

  const startSimulation = async () => {
    try {
      setSimulating(true);
      await api.post("/api/transaction/simulate", {
        count: Number(form.count),
        durationSeconds: Number(form.durationSeconds),
      });
      fetchDashboardData();
    } catch (err) {
      const d = err?.response?.data;
      const msg =
        (typeof d?.error === "string" && d.error) ||
        (typeof d?.message === "string" && d.message) ||
        err?.message ||
        "Unable to start simulation";
      alert(msg);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Simulation & scoring</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Stream synthetic transactions for load testing. Fraud-like traffic mix is randomized on the server each
          tick—you cannot tune the ratio from the UI.
        </p>
      </div>

      {error && (
        <div
          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,420px)] lg:items-start">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Transaction stream</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Generate between 10 and 1000 scored events spread across your chosen duration.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--foreground)]">
              Count
              <input
                type="number"
                min="10"
                max="1000"
                className="rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-2.5 text-[var(--foreground)] outline-none transition-shadow focus:ring-2 focus:ring-[var(--accent)]/30"
                value={form.count}
                onChange={(e) => setForm((prev) => ({ ...prev, count: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--foreground)]">
              Duration (seconds)
              <input
                type="number"
                min="10"
                max="600"
                className="rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-2.5 text-[var(--foreground)] outline-none transition-shadow focus:ring-2 focus:ring-[var(--accent)]/30"
                value={form.durationSeconds}
                onChange={(e) => setForm((prev) => ({ ...prev, durationSeconds: e.target.value }))}
              />
            </label>
          </div>

          <div className="mt-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)]/60 px-4 py-3 text-xs text-[var(--muted)]">
            Synthetic fraud pressure is sampled per event on the backend (not exposed to clients).
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startSimulation}
              disabled={simulating}
              className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60"
            >
              {simulating ? "Starting…" : "Start stream"}
            </button>
            <button
              type="button"
              onClick={fetchDashboardData}
              className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
            >
              Refresh status
            </button>
          </div>

          <div className="mt-8 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">Active jobs</h3>
            {(stats?.simulation_status || []).length === 0 && (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--background)]/40 px-4 py-6 text-sm text-[var(--muted)]">
                No simulation running yet.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {(stats?.simulation_status || []).map((job) => (
                <div
                  key={job.simulation_id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--background)]/50 p-4"
                >
                  <p className="font-mono text-xs text-[var(--muted)]">{job.simulation_id.slice(0, 8)}…</p>
                  <p className="mt-1 text-sm font-semibold capitalize">{job.status}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {job.processed}/{job.total} processed · {job.flagged} flagged · {job.alerts} alerts
                  </p>
                  {job.lastError && <p className="mt-2 text-xs text-red-400">{job.lastError}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <TransactionForm onTransactionProcessed={fetchDashboardData} />
      </div>
    </div>
  );
}
