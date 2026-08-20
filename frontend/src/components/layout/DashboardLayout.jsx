import { NavLink, Outlet, useNavigate } from "react-router-dom";

const linkClass = ({ isActive }) =>
  [
    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-[var(--accent-muted)] text-[var(--accent)]"
      : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
  ].join(" ");

export default function DashboardLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
                Fraud Ops
              </p>
              <p className="text-lg font-semibold tracking-tight">Detection Console</p>
            </div>
            <nav className="flex gap-1">
              <NavLink to="/analytics" className={linkClass}>
                Analytics
              </NavLink>
              <NavLink to="/simulation" className={linkClass}>
                Simulation
              </NavLink>
            </nav>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-200"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
        <Outlet />
      </main>
    </div>
  );
}
