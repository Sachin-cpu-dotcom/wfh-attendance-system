import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import StatCard from "../components/StatCard";
import Loader from "../components/Loader";
import {
  AttendanceTrendChart,
  StatusPieChart,
  buildDailyTrend,
  buildStatusBreakdown,
} from "../components/AttendanceCharts";
import { fetchAttendance, fetchEmployees } from "../services/googleService";
import { filterByRange } from "../utils/attendanceUtils";

export default function ManagerDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attendance, setAttendance] = useState([]);
  const [teamSize, setTeamSize] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const att = await fetchAttendance();
        const emps = await fetchEmployees();
        if (cancelled) return;
        setAttendance(Array.isArray(att) ? att : att?.data || []);
        setTeamSize((Array.isArray(emps) ? emps : emps?.data || []).length);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Couldn't load team attendance right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const todaysAttendance = filterByRange(attendance, { type: "today" });
  const presentEmpIds = new Set(todaysAttendance.filter((a) => a.checkIn).map((a) => a.empId));
  const present = presentEmpIds.size;
  const onBreak = todaysAttendance.filter((a) => a.status === "Break" || a.status === "On Break").length;

  const trend = buildDailyTrend(attendance, teamSize);
  const statusBreakdown = buildStatusBreakdown(todaysAttendance);

  return (
    <MainLayout>
      <h1 className="page-title">Manager Dashboard</h1>
      <p className="page-subtitle">Your team's status today</p>

      {loading ? (
        <Loader label="Loading team status..." />
      ) : (
        <>
          {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}
          <div className="stat-grid">
            <StatCard title="Team Present" value={present} color="var(--success)" />
            <StatCard title="On Break" value={onBreak} color="var(--warning)" />
            <StatCard title="Total Logged Today" value={todaysAttendance.length} color="var(--primary)" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, marginBottom: 22 }}>
            <div className="panel">
              <h3>Last 7 days — Present vs Absent</h3>
              <AttendanceTrendChart data={trend} />
            </div>
            <div className="panel">
              <h3>Today's status breakdown</h3>
              <StatusPieChart data={statusBreakdown} />
            </div>
          </div>

          <div className="panel">
            <h3>Team attendance (today)</h3>
            {todaysAttendance.length === 0 ? (
              <div className="empty-state">No attendance records yet today.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Status</th>
                    <th>Check In</th>
                  </tr>
                </thead>
                <tbody>
                  {todaysAttendance.slice(0, 8).map((row, i) => (
                    <tr key={i}>
                      <td>{row.name || row.empId}</td>
                      <td>
                        <span className="badge badge-info">{row.status || "—"}</span>
                      </td>
                      <td>{row.checkIn || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </MainLayout>
  );
}
