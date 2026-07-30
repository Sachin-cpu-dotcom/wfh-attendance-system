import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import StatCard from "../components/StatCard";
import Loader from "../components/Loader";
import {
  buildDailyTrend,
  buildStatusBreakdown,
  AttendanceTrendChart,
  StatusPieChart,
} from "../components/AttendanceCharts";
import { fetchEmployees, fetchAttendance } from "../services/googleService";
import { filterByRange } from "../utils/attendanceUtils";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const emps = await fetchEmployees();
        const att = await fetchAttendance();
        if (cancelled) return;
        setEmployees(Array.isArray(emps) ? emps : emps?.data || []);
        setAttendance(Array.isArray(att) ? att : att?.data || []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Couldn't load live data. Showing dashboard shell only.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = employees.length;
  const todaysAttendance = filterByRange(attendance, { type: "today" });
  const presentEmpIds = new Set(
    todaysAttendance.filter((a) => a.checkIn).map((a) => a.empId)
  );
  const present = presentEmpIds.size;
  const absent = Math.max(total - present, 0);

  const trend = buildDailyTrend(attendance, total);
  const statusBreakdown = buildStatusBreakdown(todaysAttendance);

  return (
    <MainLayout>
      <h1 className="page-title">Admin Dashboard</h1>
      <p className="page-subtitle">Organization-wide attendance at a glance</p>

      {loading ? (
        <Loader label="Loading dashboard..." />
      ) : (
        <>
          {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

          <div className="stat-grid">
            <StatCard title="Total Employees" value={total} color="var(--primary)" />
            <StatCard title="Present Today" value={present} color="var(--success)" />
            <StatCard title="Absent Today" value={absent} color="var(--danger)" />
            <StatCard
              title="Attendance Rate"
              value={total ? `${Math.round((present / total) * 100)}%` : "—"}
              color="var(--info)"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
            <div className="panel">
              <h3>Last 7 days — Present vs Absent</h3>
              <AttendanceTrendChart data={trend} />
            </div>
            <div className="panel">
              <h3>Today's status breakdown</h3>
              <StatusPieChart data={statusBreakdown} />
            </div>
          </div>
        </>
      )}
    </MainLayout>
  );
}
