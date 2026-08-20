import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export function useDashboardPolling(intervalMs = 5000) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      const [statsRes, historyRes] = await Promise.all([
        api.get("/api/transaction/stats?limit=3000"),
        api.get("/api/transaction/history?limit=100"),
      ]);
      setStats(statsRes.data);
      const rows = historyRes.data;
      setHistory(Array.isArray(rows) ? rows : []);
    } catch (err) {
      if (err?.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/");
        return;
      }
      const data = err?.response?.data;
      const msg =
        (typeof data?.error === "string" && data.error) ||
        (typeof data?.message === "string" && data.message) ||
        err?.message ||
        "Could not load dashboard data. Is the backend running on port 5000?";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchDashboardData();
    const id = window.setInterval(fetchDashboardData, intervalMs);
    return () => window.clearInterval(id);
  }, [fetchDashboardData, intervalMs]);

  return { stats, history, loading, error, fetchDashboardData };
}
