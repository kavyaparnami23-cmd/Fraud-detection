import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import DashboardLayout from "./components/layout/DashboardLayout";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import Login from "./pages/Login";
import LoginSuccess from "./pages/LoginSuccess";
import SimulationPage from "./pages/SimulationPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login-success" element={<LoginSuccess />} />
        <Route element={<DashboardLayout />}>
          <Route path="/analytics" element={<AnalyticsDashboard />} />
          <Route path="/simulation" element={<SimulationPage />} />
        </Route>
        <Route path="/dashboard" element={<Navigate to="/analytics" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
